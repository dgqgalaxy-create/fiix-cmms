import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import defaultPrisma from '../config/prisma';
import type { Prisma } from '@prisma/client';
import { parseCsvDate } from './parseCsvDate';
import type { ImportFileLike } from './runCsvImport';

export type InventoryRowProblem = { row: number; reason: string };

export type InventoryImportDetails = {
  /** Movimientos nuevos creados. */
  created: number;
  /** Filas que ya existían (mismo external_id o misma tupla) → omitidas. */
  skippedExisting: number;
  /** Filas que no se pudieron importar, con motivo (fila del CSV = nº línea, header = 1). */
  ignored: InventoryRowProblem[];
  /** Usuarios inexistentes que se crearon automáticamente (inactivos), como antes. */
  autoCreatedUsers: number;
};

function readImportFileUtf8(file: ImportFileLike): string {
  if (file.buffer && file.buffer.length > 0) {
    return file.buffer.toString('utf8');
  }
  if (file.path && fs.existsSync(file.path)) {
    return fs.readFileSync(file.path, 'utf8');
  }
  return '';
}

const parseNumber = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Importa movimientos desde `Items - Inventory.csv` SIN borrar el historial.
 *
 * Antes este bloque hacía `TRUNCATE "InventoryTransaction" CASCADE` y volvía a
 * insertar el CSV, con lo que un re-import borraba los movimientos capturados en
 * la app (salidas offline, consumos de OT, recepciones de OC…). Ahora:
 *
 * - Nunca borra: solo CREA movimientos que no existan.
 * - Dedupe por `external_id` (columna "Inventory ID" de Fiix) y, como respaldo,
 *   por tupla exacta (item, usuario, cantidad, motivo, fecha) para CSVs antiguos
 *   o datos previos sin external_id.
 * - Las filas que no pueden importarse (usuario/repuesto inexistente, fila
 *   incompleta) se REPORTAN con fila y motivo en vez de descartarse en silencio.
 * - Los usuarios que faltan se siguen auto-creando (inactivos) para no perder el
 *   histórico (comportamiento v1.11.10).
 */
export async function importInventoryTransactionsFile(
  file: ImportFileLike,
  opts?: { dryRun?: boolean; client?: Prisma.TransactionClient; strict?: boolean }
): Promise<InventoryImportDetails> {
  const prisma = opts?.client ?? defaultPrisma;
  const details: InventoryImportDetails = {
    created: 0,
    skippedExisting: 0,
    ignored: [],
    autoCreatedUsers: 0,
  };

  const data = parse(readImportFileUtf8(file), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>;
  if (data.length === 0) return details;

  const allUsers = await prisma.user.findMany();
  const allItems = await prisma.item.findMany();
  const userMap: Record<string, string> = Object.fromEntries(allUsers.map((u) => [u.email, u.id]));
  const itemMap: Record<string, string> = Object.fromEntries(
    allItems.map((i) => [i.internal_code, i.id])
  );

  // Usuarios que aparecen en movimientos pero no existen → auto-crear (inactivos).
  // En modo vista previa (dryRun) no se crea nada: solo se informa cuántos se crearían.
  const invDefaultHash = await bcrypt.hash('CMMS2026*', 10);
  const missingEmails = new Set<string>();
  for (const row of data) {
    const email = row['User ID'] ? row['User ID'].trim() : '';
    if (email && !userMap[email]) missingEmails.add(email);
  }
  if (opts?.dryRun) {
    details.autoCreatedUsers = missingEmails.size;
    // Marcador virtual: en la vista previa las filas de esos usuarios SÍ se contarían.
    for (const email of missingEmails) userMap[email] = '__auto__';
  } else {
    for (const email of missingEmails) {
      try {
        const created = await prisma.user.create({
          data: {
            name: email.split('@')[0],
            email,
            password_hash: invDefaultHash,
            role: Role.TECNICO,
            is_active: false,
            must_change_password: true,
          },
        });
        userMap[email] = created.id;
        details.autoCreatedUsers++;
      } catch (e) {
        // Carrera con otra creación simultánea; se reporta la fila como ignorada.
        if (opts?.strict) throw e;
        console.error('Inventory user auto-create error', email, e);
      }
    }
  }

  // Movimientos ya existentes, para detectar duplicados.
  const existing = await prisma.inventoryTransaction.findMany({
    select: {
      id: true,
      external_id: true,
      item_id: true,
      user_id: true,
      amount: true,
      reason: true,
      created_at: true,
    },
  });
  const byExternalId = new Set<string>();
  const tupleKey = (itemId: string, userId: string, amount: number, reason: string, date: Date | null) =>
    `${itemId}|${userId}|${amount}|${reason}|${date ? date.getTime() : ''}`;
  const existingTuples = new Set<string>();
  for (const t of existing) {
    if (t.external_id) byExternalId.add(t.external_id);
    existingTuples.add(tupleKey(t.item_id, t.user_id, t.amount, t.reason ?? '', t.created_at));
  }

  const seenExternalInFile = new Set<string>();
  const seenTupleInFile = new Set<string>();
  const creates: Array<{
    item_id: string;
    user_id: string;
    amount: number;
    reason: string;
    created_at: Date;
    external_id?: string;
  }> = [];

  data.forEach((row, idx) => {
    const csvLine = idx + 2; // header = fila 1
    const email = row['User ID'] ? row['User ID'].trim() : null;
    const itemCode = row['Item ID'] ? row['Item ID'].trim() : null;
    const rawExternal = row['Inventory ID'] ? String(row['Inventory ID']).trim() : '';
    const externalId = rawExternal ? `INV:${rawExternal}` : null;

    if (!email || !itemCode) {
      details.ignored.push({ row: csvLine, reason: 'Fila incompleta (falta User ID o Item ID)' });
      return;
    }

    const itemId = itemMap[itemCode];
    if (!itemId) {
      details.ignored.push({ row: csvLine, reason: `Repuesto inexistente: ${itemCode}` });
      return;
    }

    const userId = userMap[email];
    if (!userId) {
      details.ignored.push({ row: csvLine, reason: `Usuario inexistente y no se pudo crear: ${email}` });
      return;
    }

    const date = parseCsvDate(row['DateTime']);
    const amount = parseNumber(row['Amount']);
    const reason = row['Reason'] || 'Sin motivo';
    if (!date || !Number.isFinite(amount) || amount === 0) {
      details.ignored.push({ row: csvLine, reason: 'Fecha o cantidad inválida' });
      return;
    }

    // Dedupe: con external_id ("Inventory ID" de Fiix) la clave ES exclusiva — dos
    // movimientos legítimos idénticos pero con IDs distintos NUNCA se descartan. La tupla
    // (item|usuario|cantidad|motivo|fecha) solo se usa como respaldo para filas SIN
    // external_id (CSVs antiguos o datos previos sin clave).
    if (externalId) {
      if (seenExternalInFile.has(externalId) || byExternalId.has(externalId)) {
        seenExternalInFile.add(externalId);
        details.skippedExisting++;
        return;
      }
      seenExternalInFile.add(externalId);
    } else {
      const tup = tupleKey(itemId, userId, amount, reason, date);
      if (existingTuples.has(tup) || seenTupleInFile.has(tup)) {
        details.skippedExisting++;
        return;
      }
      seenTupleInFile.add(tup);
    }

    creates.push({
      item_id: itemId,
      user_id: userId,
      amount,
      reason,
      created_at: date ?? new Date(),
      ...(externalId ? { external_id: externalId } : {}),
    });
  });

  if (opts?.strict && details.ignored.length) {
    const bad = details.ignored[0];
    throw new Error(`Movimientos, fila ${bad.row}: ${bad.reason}`);
  }
  if (opts?.dryRun) {
    details.created = creates.length;
  } else if (creates.length > 0) {
    // skipDuplicates: red de seguridad extra si dos procesos importan a la vez.
    const res = await prisma.inventoryTransaction.createMany({
      data: creates,
      skipDuplicates: true,
    });
    details.created = res.count;
    details.skippedExisting += creates.length - details.created;
  }

  return details;
}
