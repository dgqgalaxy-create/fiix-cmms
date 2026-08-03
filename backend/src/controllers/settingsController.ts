import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { DEFAULT_SLA_POLICY, mergeSlaPolicy } from '../services/SlaService';
import { emitRefresh } from '../utils/socket';

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled: true,
          email_enabled: false,
          sla_enabled: true,
          sla_policy: DEFAULT_SLA_POLICY,
        },
      });
    }
    res.json({
      ...settings,
      sla_policy: mergeSlaPolicy(settings.sla_policy),
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegram_enabled, email_enabled, sla_enabled, sla_policy, checklist_column_count, technician_mobile_ui } = req.body;
    let settings = await prisma.systemSettings.findFirst();

    const nextPolicy =
      sla_policy !== undefined ? mergeSlaPolicy(sla_policy) : undefined;

    const nextColumnCount =
      checklist_column_count !== undefined
        ? Math.min(12, Math.max(1, Math.round(Number(checklist_column_count))))
        : undefined;

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled: telegram_enabled ?? true,
          email_enabled: email_enabled ?? false,
          sla_enabled: sla_enabled ?? true,
          sla_policy: nextPolicy ?? DEFAULT_SLA_POLICY,
          technician_mobile_ui: technician_mobile_ui ?? true,
          ...(nextColumnCount !== undefined ? { checklist_column_count: nextColumnCount } : {}),
        },
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          telegram_enabled: telegram_enabled ?? settings.telegram_enabled,
          email_enabled: email_enabled ?? settings.email_enabled,
          sla_enabled: sla_enabled ?? settings.sla_enabled,
          ...(technician_mobile_ui !== undefined ? { technician_mobile_ui: Boolean(technician_mobile_ui) } : {}),
          ...(nextPolicy ? { sla_policy: nextPolicy } : {}),
          ...(nextColumnCount !== undefined ? { checklist_column_count: nextColumnCount } : {}),
        },
      });
    }
    emitRefresh('refresh_settings');
    res.json({
      ...settings,
      sla_policy: mergeSlaPolicy(settings.sla_policy),
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getUoms = async (req: Request, res: Response) => {
  try {
    const uoms = await prisma.unitOfMeasure.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(uoms);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createUom = async (req: Request, res: Response) => {
  try {
    const { name, default_qty_mode } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio' });
      return;
    }
    const mode =
      default_qty_mode === 'DECIMAL' || default_qty_mode === 'INTEGER'
        ? default_qty_mode
        : 'INTEGER';
    const uom = await prisma.unitOfMeasure.create({
      data: {
        name: name.trim().toUpperCase(),
        default_qty_mode: mode,
      },
    });
    emitRefresh('refresh_settings');
    emitRefresh('refresh_inventory');
    res.json(uom);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(400).json({ error: 'Esa unidad de medida ya existe' });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteUom = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.unitOfMeasure.delete({ where: { id } });
    emitRefresh('refresh_settings');
    emitRefresh('refresh_inventory');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateUom = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, default_qty_mode } = req.body;
    const data: { name?: string; default_qty_mode?: 'INTEGER' | 'DECIMAL' } = {};

    if (typeof name === 'string' && name.trim()) {
      data.name = name.trim().toUpperCase();
    }
    if (default_qty_mode === 'DECIMAL' || default_qty_mode === 'INTEGER') {
      data.default_qty_mode = default_qty_mode;
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Nada que actualizar' });
      return;
    }

    const uom = await prisma.unitOfMeasure.update({
      where: { id },
      data,
    });
    emitRefresh('refresh_settings');
    emitRefresh('refresh_inventory');
    res.json(uom);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(400).json({ error: 'Esa unidad de medida ya existe' });
      return;
    }
    if (error?.code === 'P2025') {
      res.status(404).json({ error: 'Unidad no encontrada' });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
