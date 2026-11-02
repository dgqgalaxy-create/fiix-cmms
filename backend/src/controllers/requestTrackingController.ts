import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import path from 'path';
import prisma from '../config/prisma';

// Public status only. Search terms never expand the returned fields.
export const requestTrackingSelect = { folio: true, status: true } satisfies Prisma.WorkOrderSelect;

// Requester-facing detail. Internal data (comments, costs, parts, signatures) stays private.
export const requestTrackingDetailSelect = {
  folio: true,
  status: true,
  title: true,
  description: true,
  requester_name: true,
  priority: true,
  maintenance_type: true,
  machine_stopped: true,
  production_group: true,
  created_at: true,
  scheduled_date: true,
  due_date: true,
  started_at: true,
  completed_at: true,
  hold_reason: true,
  resolution_notes: true,
  request_image_url: true,
  before_image_url: true,
  after_image_url: true,
  zone: { select: { name: true } },
  asset: { select: { name: true, internal_code: true } },
  assigned_technicians: { select: { name: true } },
  failure_problem: { select: { name: true } },
  failure_cause: { select: { name: true } },
  failure_remedy: { select: { name: true } },
} satisfies Prisma.WorkOrderSelect;

const EVIDENCE_FIELDS = {
  request: 'request_image_url',
  before: 'before_image_url',
  after: 'after_image_url',
} as const;

type EvidenceKind = keyof typeof EVIDENCE_FIELDS;

function parseTrackingFolio(raw: string): number {
  const match = raw
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, '')
    .match(/^(?:(?:FOL|WO)-?)?(\d+)$/i);
  const number = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647) {
    throw new Error('Escribe un folio válido, por ejemplo FOL-0042.');
  }
  return number;
}

export function trackingQuery(query: Request['query']) {
  const read = (key: string) => {
    const value = query[key];
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > 150) throw new Error('Parámetros de búsqueda inválidos.');
    return value.trim();
  };
  const folio = read('folio');
  const zone = read('zone');
  const requester = read('requester');
  const pageRaw = read('page') || '1';
  if (!folio && !zone && !requester) throw new Error('Busca por folio, zona o nombre del solicitante.');
  if (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1 || Number(pageRaw) > 10000) throw new Error('Página inválida.');
  const where: Prisma.WorkOrderWhereInput = {};
  if (folio) {
    where.folio = parseTrackingFolio(folio);
  }
  if (zone) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(zone)) throw new Error('Selecciona una zona válida.');
    where.zone_id = zone;
  }
  if (requester) {
    if (requester.length < 2) throw new Error('Escribe al menos dos caracteres del nombre.');
    where.requester_name = { contains: requester, mode: 'insensitive' };
  }
  return { where, page: Number(pageRaw), pageSize: 20 };
}

export async function getRequestTracking(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  let params;
  try { params = trackingQuery(req.query); }
  catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }
  try {
    const { where, page, pageSize } = params;
    const [total, requests] = await prisma.$transaction([
      prisma.workOrder.count({ where }),
      prisma.workOrder.findMany({
        where, select: requestTrackingSelect,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    res.json({ requests, total, page, pageSize });
  } catch (error) {
    console.error('Error consulting public request status:', error);
    res.status(500).json({ error: 'No se pudo consultar el estado. Intenta nuevamente.' });
  }
}

export async function getRequestTrackingDetail(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  let folio: number;
  try { folio = parseTrackingFolio(String(req.params.folio || '')); }
  catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }
  try {
    const workOrder = await prisma.workOrder.findFirst({
      where: { folio },
      select: requestTrackingDetailSelect,
    });
    if (!workOrder) {
      res.status(404).json({ error: 'No se encontró la solicitud indicada.' });
      return;
    }

    const {
      request_image_url: requestImage,
      before_image_url: beforeImage,
      after_image_url: afterImage,
      ...detail
    } = workOrder;

    const images: { kind: EvidenceKind; label: string }[] = [];
    if (requestImage && requestImage !== beforeImage) images.push({ kind: 'request', label: 'Al reportar' });
    if (beforeImage) images.push({ kind: 'before', label: 'Antes de reparar' });
    if (afterImage) images.push({ kind: 'after', label: 'Después' });

    res.json({ ...detail, images });
  } catch (error) {
    console.error('Error consulting public request detail:', error);
    res.status(500).json({ error: 'No se pudo consultar el detalle. Intenta nuevamente.' });
  }
}

export async function getRequestTrackingEvidence(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  let folio: number;
  try { folio = parseTrackingFolio(String(req.params.folio || '')); }
  catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }

  const kind = String(req.params.kind || '') as EvidenceKind;
  if (!(kind in EVIDENCE_FIELDS)) {
    res.status(404).json({ error: 'Evidencia no encontrada.' });
    return;
  }

  try {
    const workOrder = await prisma.workOrder.findFirst({
      where: { folio },
      select: { request_image_url: true, before_image_url: true, after_image_url: true },
    });
    if (!workOrder) {
      res.status(404).json({ error: 'Evidencia no encontrada.' });
      return;
    }

    const raw = workOrder[EVIDENCE_FIELDS[kind]];
    if (!raw) {
      res.status(404).json({ error: 'Evidencia no encontrada.' });
      return;
    }
    const relative = raw.replace(/^\/+/, '');
    if (!relative.startsWith('uploads/')) {
      res.status(404).json({ error: 'Evidencia no encontrada.' });
      return;
    }

    const filePath = path.join(__dirname, '../../uploads', path.basename(relative));
    res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ error: 'Evidencia no encontrada.' });
      }
    });
  } catch (error) {
    console.error('Error loading public request evidence:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'No se pudo cargar la evidencia.' });
    }
  }
}
