// Run from backend: node --test -r ts-node/register/transpile-only tests/personalStickyNotes.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const prisma = require('../src/config/prisma').default;
const socket = require('../src/utils/socket');
socket.emitRefresh = () => {};
const { createPersonalNote, updatePersonalNote } = require('../src/controllers/notesController');
const { runNotesReminders } = require('../src/utils/notesReminders');
const res = () => ({ code: 200, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } });

test('free text preserves paragraphs and disables requested reminder', async () => {
  const original = prisma.personalNote.create;
  prisma.personalNote.create = async ({ data }) => data;
  try {
    const response = res();
    await createPersonalNote({ user: { userId: 'owner' }, body: { content: '  Primera línea\n\nDetalle libre  ', remind_at: '2030-01-01' } }, response);
    assert.equal(response.code, 201);
    assert.equal(response.body.title, '');
    assert.equal(response.body.body, '  Primera línea\n\nDetalle libre  ');
    assert.equal(response.body.remind_at, null);
    for (const content of ['  ', 'a'.repeat(10001), 123]) {
      const invalid = res();
      await createPersonalNote({ user: { userId: 'owner' }, body: { content } }, invalid);
      assert.equal(invalid.code, 400);
    }
  } finally { prisma.personalNote.create = original; }
});

test('editing supports merged legacy content and retains ownership checks', async () => {
  const find = prisma.personalNote.findUnique;
  const update = prisma.personalNote.update;
  let writes = 0;
  prisma.personalNote.findUnique = async () => ({ id: 'note', user_id: 'owner', title: 'Antes', body: 'Detalle' });
  prisma.personalNote.update = async ({ data }) => { writes++; return data; };
  try {
    const response = res();
    await updatePersonalNote({ user: { userId: 'owner' }, params: { id: 'note' }, body: { content: 'Antes\n\nDetalle' } }, response);
    assert.equal(response.body.body, 'Antes\n\nDetalle');
    assert.equal(response.body.title, '');
    assert.equal(response.body.remind_at, null);
    const forbidden = res();
    await updatePersonalNote({ user: { userId: 'other' }, params: { id: 'note' }, body: { content: 'No' } }, forbidden);
    assert.equal(forbidden.code, 404);
    assert.equal(writes, 1);
  } finally { prisma.personalNote.findUnique = find; prisma.personalNote.update = update; }
});

test('scheduler ignores all personal reminders and still checks operational tasks', async () => {
  const notes = prisma.personalNote.findMany;
  const tasks = prisma.operationalTask.findMany;
  let taskQueries = 0;
  prisma.personalNote.findMany = () => { throw new Error('Personal reminders must never be queried'); };
  prisma.operationalTask.findMany = async () => { taskQueries++; return []; };
  try {
    assert.deepEqual(await runNotesReminders(), { notes: 0, tasks: 0 });
    assert.equal(taskQueries, 1);
  } finally { prisma.personalNote.findMany = notes; prisma.operationalTask.findMany = tasks; }
});
