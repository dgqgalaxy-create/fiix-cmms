/**
 * Regresión v1.70.0: edición y borrado de patrones de turno.
 * Sin base de datos: mockea Prisma y verifica validaciones + llamadas.
 * Ejecutar: node --require ts-node/register/transpile-only --test tests/rosterPattern.test.cjs
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const prisma = require('../src/config/prisma').default;
require('../src/utils/socket').emitRefresh = () => {};
const { assignPattern, removePattern } = require('../src/controllers/rosterController');

const userId = '11111111-1111-1111-1111-111111111111';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

function withMocks({ person = { id: userId, is_active: true }, existing = null } = {}) {
  const calls = { upsert: 0, delete: 0, upsertArgs: null, deleteArgs: null };
  const originals = {
    userFindUnique: prisma.user.findUnique,
    patternUpsert: prisma.technicianPattern.upsert,
    patternDelete: prisma.technicianPattern.delete,
    patternFindUnique: prisma.technicianPattern.findUnique,
  };
  prisma.user.findUnique = async () => person;
  prisma.technicianPattern.upsert = async (args) => { calls.upsert += 1; calls.upsertArgs = args; return args.create; };
  prisma.technicianPattern.delete = async (args) => { calls.delete += 1; calls.deleteArgs = args; return { ok: true }; };
  prisma.technicianPattern.findUnique = async () => existing;
  const restore = () => {
    prisma.user.findUnique = originals.userFindUnique;
    prisma.technicianPattern.upsert = originals.patternUpsert;
    prisma.technicianPattern.delete = originals.patternDelete;
    prisma.technicianPattern.findUnique = originals.patternFindUnique;
  };
  return { calls, restore };
}

test('asignar: rechaza un tipo de patrón inválido sin tocar la BD', async () => {
  const { calls, restore } = withMocks();
  try {
    const res = response();
    await assignPattern({ body: { user_id: userId, pattern_type: 'SEMANAL', start_date: '2026-10-20' } }, res);
    assert.equal(res.code, 400);
    assert.equal(calls.upsert, 0);
  } finally { restore(); }
});

test('asignar: crea/actualiza el patrón (upsert por user_id) con tipo y fecha válidos', async () => {
  const { calls, restore } = withMocks();
  try {
    const res = response();
    await assignPattern({ body: { user_id: userId, pattern_type: 'MIXTO', start_date: '2026-10-20' } }, res);
    assert.equal(res.code, 200);
    assert.equal(calls.upsert, 1);
    assert.equal(calls.upsertArgs.where.user_id, userId);
    assert.equal(calls.upsertArgs.update.pattern_type, 'MIXTO');
    assert.ok(calls.upsertArgs.update.start_date instanceof Date);
  } finally { restore(); }
});

test('asignar: rechaza personal inactivo', async () => {
  const { calls, restore } = withMocks({ person: { id: userId, is_active: false } });
  try {
    const res = response();
    await assignPattern({ body: { user_id: userId, pattern_type: '4X4_FIJO', start_date: '2026-10-20' } }, res);
    assert.equal(res.code, 400);
    assert.equal(calls.upsert, 0);
  } finally { restore(); }
});

test('quitar: borra el patrón existente', async () => {
  const { calls, restore } = withMocks({ existing: { id: 'p1', user_id: userId } });
  try {
    const res = response();
    await removePattern({ params: { userId } }, res);
    assert.equal(res.code, 200);
    assert.equal(calls.delete, 1);
    assert.equal(calls.deleteArgs.where.user_id, userId);
  } finally { restore(); }
});

test('quitar: 404 si la persona no tiene patrón y 400 con id inválido', async () => {
  {
    const { calls, restore } = withMocks({ existing: null });
    try {
      const res = response();
      await removePattern({ params: { userId } }, res);
      assert.equal(res.code, 404);
      assert.equal(calls.delete, 0);
    } finally { restore(); }
  }
  {
    const { calls, restore } = withMocks();
    try {
      const res = response();
      await removePattern({ params: { userId: 'no-es-uuid' } }, res);
      assert.equal(res.code, 400);
      assert.equal(calls.delete, 0);
    } finally { restore(); }
  }
});
