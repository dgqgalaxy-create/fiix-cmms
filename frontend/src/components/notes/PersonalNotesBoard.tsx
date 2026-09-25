import { useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { createPersonalNote, updatePersonalNote, deletePersonalNote, type PersonalNote } from '../../api/notes';

function personalNoteText(note: PersonalNote): string {
  return [note.title, note.body].filter(Boolean).join('\n\n');
}
const colors = [
  'border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  'border-sky-200 bg-sky-100 text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100',
  'border-rose-200 bg-rose-100 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
  'border-emerald-200 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
];

function NoteCard({ note, canWrite, onChanged }: { note?: PersonalNote; canWrite: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(!note);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const color = note ? [...note.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length : 0;
  const run = async (action: () => Promise<unknown>, saved = false) => {
    setBusy(true); setError('');
    try {
      await action();
      if (saved) { setText(''); setEditing(!note); }
      await onChanged();
    } catch { setError('No se pudo guardar el cambio. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };
  return <article className={`flex min-h-64 min-w-0 flex-col rounded-sm border p-4 shadow-md ${colors[color]} ${note?.is_done ? 'opacity-70' : ''}`}>
    <div className="mb-3 flex items-center justify-between gap-2 text-xs">
      <span className="font-semibold">{note ? note.is_done ? 'Archivada' : 'Mi nota' : 'Nueva nota'}</span>
      {note && canWrite && !editing && <div className="flex gap-1">
        <button type="button" aria-label="Editar nota" title="Editar nota" disabled={busy} onClick={() => { setText(personalNoteText(note)); setEditing(true); }} className="rounded p-2 hover:bg-black/5"><Pencil size={15} /></button>
        <button type="button" aria-label={note.is_done ? 'Restaurar nota' : 'Archivar nota'} title={note.is_done ? 'Restaurar nota' : 'Archivar nota'} disabled={busy} onClick={() => void run(() => updatePersonalNote(note.id, { is_done: !note.is_done }))} className="rounded p-2 hover:bg-black/5">{note.is_done ? <RotateCcw size={15} /> : <Check size={15} />}</button>
        <button type="button" aria-label="Eliminar nota" title="Eliminar nota" disabled={busy} onClick={() => { if (window.confirm('¿Eliminar esta nota?')) void run(() => deletePersonalNote(note.id)); }} className="rounded p-2 hover:bg-black/5"><Trash2 size={15} /></button>
      </div>}
    </div>
    {editing ? <>
      <textarea aria-label={note ? 'Editar texto de la nota' : 'Texto de nueva nota'} placeholder="Escribe aquí lo que quieras recordar…" value={text} onChange={event => setText(event.target.value)} maxLength={10000} rows={8} disabled={busy} className="min-h-40 w-full flex-1 resize-y border-0 bg-transparent text-sm leading-relaxed outline-none placeholder:text-current/50 focus:ring-0" />
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-current/10 pt-3">
        {note && <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(''); }} className="text-xs">Cancelar</button>}
        <button type="button" disabled={busy || !text.trim()} onClick={() => void run(() => note ? updatePersonalNote(note.id, { content: text }) : createPersonalNote({ content: text }), true)} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-black/10 px-3 py-2 text-xs font-bold hover:bg-black/15 disabled:opacity-40">{note ? <Check size={14} /> : <Plus size={14} />}{busy ? 'Guardando…' : note ? 'Guardar cambios' : 'Guardar nota'}</button>
      </div>
    </> : <button type="button" disabled={!canWrite || busy} onClick={() => { setText(personalNoteText(note!)); setEditing(true); }} className="flex-1 whitespace-pre-wrap break-words text-left text-sm leading-relaxed [overflow-wrap:anywhere] disabled:cursor-default">{personalNoteText(note!)}</button>}
    {error && <p role="alert" className="mt-2 text-xs font-semibold">{error}</p>}
  </article>;
}

export function PersonalNotesBoard({ notes, loading, canWrite, onChanged }: { notes: PersonalNote[]; loading: boolean; canWrite: boolean; onChanged: () => Promise<void> }) {
  return <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {canWrite && <NoteCard canWrite={canWrite} onChanged={onChanged} />}
    {loading && <p role="status" className="p-4 text-sm text-slate-500">Cargando notas…</p>}
    {notes.map(note => <NoteCard key={note.id} note={note} canWrite={canWrite} onChanged={onChanged} />)}
    {!loading && notes.length === 0 && <p className="p-4 text-sm text-slate-500">{canWrite ? 'Tu tablero está vacío. Escribe tu primera nota.' : 'Sin notas para mostrar.'}</p>}
  </div>;
}
