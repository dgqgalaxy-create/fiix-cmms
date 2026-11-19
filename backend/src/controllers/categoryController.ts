import type { Request, Response } from 'express';
import prisma from '../config/prisma';
import { writeAuditLog } from '../utils/auditLog';
import { emitRefresh } from '../utils/socket';

type CategoryKind = 'asset' | 'work_order';

const MODEL = {
  asset: prisma.assetCategory,
  work_order: prisma.workOrderCategory,
} as const;

const LABEL: Record<CategoryKind, string> = {
  asset: 'categoría de activos',
  work_order: 'categoría de órdenes',
};

const readName = (value: unknown): string => String(value ?? '').trim().slice(0, 60);
const readDescription = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 200) : null;
};

const list = async (kind: CategoryKind, res: Response): Promise<void> => {
  try {
    const rows = await (MODEL[kind] as any).findMany({
      orderBy: [{ is_active: 'desc' }, { sort_order: 'asc' }, { name: 'asc' }],
    });
    res.json(rows);
  } catch (error) {
    console.error(`Error listando ${LABEL[kind]}:`, error);
    res.status(500).json({ error: `No se pudieron obtener las ${LABEL[kind]}` });
  }
};

const create = async (kind: CategoryKind, req: Request, res: Response): Promise<void> => {
  try {
    const name = readName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: 'Escribe el nombre.' });
      return;
    }
    const existing = await (MODEL[kind] as any).findFirst({ where: { name } });
    if (existing) {
      res.status(409).json({ error: `Ya existe una ${LABEL[kind]} con ese nombre.` });
      return;
    }
    const row = await (MODEL[kind] as any).create({
      data: {
        name,
        description: readDescription(req.body?.description),
        ...(kind === 'work_order' ? { color: String(req.body?.color ?? '').trim() || null } : {}),
        sort_order: Number.isFinite(Number(req.body?.sort_order)) ? Math.round(Number(req.body.sort_order)) : 0,
      },
    });
    void writeAuditLog({
      userId: (req as any).user?.userId ?? null,
      userName: null,
      action: kind === 'asset' ? 'ASSET_CATEGORY_CREATED' : 'WORK_ORDER_CATEGORY_CREATED',
      entity: kind === 'asset' ? 'asset_category' : 'work_order_category',
      entityId: row.id,
      summary: `Se creó la ${LABEL[kind]} «${name}».`,
      meta: { name },
    });
    emitRefresh('refresh_settings');
    emitRefresh(kind === 'asset' ? 'refresh_assets' : 'refresh_work_orders');
    res.status(201).json(row);
  } catch (error) {
    console.error(`Error creando ${LABEL[kind]}:`, error);
    res.status(500).json({ error: `No se pudo crear la ${LABEL[kind]}` });
  }
};

const update = async (kind: CategoryKind, req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const current = await (MODEL[kind] as any).findUnique({ where: { id } });
    if (!current) {
      res.status(404).json({ error: `La ${LABEL[kind]} no existe.` });
      return;
    }
    const data: Record<string, unknown> = {};
    if (req.body?.name !== undefined) {
      const name = readName(req.body.name);
      if (!name) {
        res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
        return;
      }
      const duplicate = await (MODEL[kind] as any).findFirst({ where: { name, id: { not: id } } });
      if (duplicate) {
        res.status(409).json({ error: `Ya existe una ${LABEL[kind]} con ese nombre.` });
        return;
      }
      data.name = name;
    }
    if (req.body?.description !== undefined) data.description = readDescription(req.body.description);
    if (kind === 'work_order' && req.body?.color !== undefined) {
      data.color = String(req.body.color ?? '').trim() || null;
    }
    if (req.body?.is_active !== undefined) data.is_active = Boolean(req.body.is_active);
    if (req.body?.sort_order !== undefined && Number.isFinite(Number(req.body.sort_order))) {
      data.sort_order = Math.round(Number(req.body.sort_order));
    }

    const row = await (MODEL[kind] as any).update({ where: { id }, data });
    void writeAuditLog({
      userId: (req as any).user?.userId ?? null,
      userName: null,
      action: kind === 'asset' ? 'ASSET_CATEGORY_UPDATED' : 'WORK_ORDER_CATEGORY_UPDATED',
      entity: kind === 'asset' ? 'asset_category' : 'work_order_category',
      entityId: id,
      summary: `Se actualizó la ${LABEL[kind]} «${row.name}».`,
      meta: { before: current, after: row },
    });
    emitRefresh('refresh_settings');
    emitRefresh(kind === 'asset' ? 'refresh_assets' : 'refresh_work_orders');
    res.json(row);
  } catch (error) {
    console.error(`Error actualizando ${LABEL[kind]}:`, error);
    res.status(500).json({ error: `No se pudo actualizar la ${LABEL[kind]}` });
  }
};

const remove = async (kind: CategoryKind, req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const current = await (MODEL[kind] as any).findUnique({ where: { id } });
    if (!current) {
      res.status(404).json({ error: `La ${LABEL[kind]} no existe.` });
      return;
    }
    const inUse =
      kind === 'asset'
        ? await prisma.asset.count({ where: { category_id: id } })
        : await prisma.workOrder.count({ where: { category_id: id } });

    if (inUse > 0) {
      res.status(409).json({
        error: `No se puede eliminar «${current.name}»: está asignada a ${inUse} registro(s). Desactívala o reasígnalos primero.`,
        in_use: inUse,
      });
      return;
    }

    await (MODEL[kind] as any).delete({ where: { id } });
    void writeAuditLog({
      userId: (req as any).user?.userId ?? null,
      userName: null,
      action: kind === 'asset' ? 'ASSET_CATEGORY_DELETED' : 'WORK_ORDER_CATEGORY_DELETED',
      entity: kind === 'asset' ? 'asset_category' : 'work_order_category',
      entityId: id,
      summary: `Se eliminó la ${LABEL[kind]} «${current.name}».`,
      meta: { name: current.name },
    });
    emitRefresh('refresh_settings');
    emitRefresh(kind === 'asset' ? 'refresh_assets' : 'refresh_work_orders');
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error(`Error eliminando ${LABEL[kind]}:`, error);
    res.status(500).json({ error: `No se pudo eliminar la ${LABEL[kind]}` });
  }
};

export const getAssetCategories = (_req: Request, res: Response): Promise<void> => list('asset', res);
export const createAssetCategory = (req: Request, res: Response): Promise<void> => create('asset', req, res);
export const updateAssetCategory = (req: Request, res: Response): Promise<void> => update('asset', req, res);
export const deleteAssetCategory = (req: Request, res: Response): Promise<void> => remove('asset', req, res);

export const getWorkOrderCategories = (_req: Request, res: Response): Promise<void> => list('work_order', res);
export const createWorkOrderCategory = (req: Request, res: Response): Promise<void> => create('work_order', req, res);
export const updateWorkOrderCategory = (req: Request, res: Response): Promise<void> => update('work_order', req, res);
export const deleteWorkOrderCategory = (req: Request, res: Response): Promise<void> => remove('work_order', req, res);
