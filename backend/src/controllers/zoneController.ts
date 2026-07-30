import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';
import { AuthRequest } from '../middlewares/authMiddleware';
import { sectionEnumFromName } from '../utils/assetSection';

const zoneInclude = {
  sections: { orderBy: { name: 'asc' as const } },
  _count: { select: { assets: true, work_orders: true } },
};

export const getZones = async (_req: Request, res: Response) => {
  try {
    const zones = await prisma.zone.findMany({
      include: zoneInclude,
      orderBy: { name: 'asc' },
    });
    res.json(zones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
};

export const createZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, has_sections } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio' });
      return;
    }

    const trimmed = String(name).trim();
    const existing = await prisma.zone.findUnique({ where: { name: trimmed } });
    if (existing) {
      res.status(400).json({ error: 'La zona ya existe' });
      return;
    }

    const newZone = await prisma.zone.create({
      data: {
        name: trimmed,
        has_sections: has_sections === false || has_sections === 'false' ? false : true,
      },
      include: zoneInclude,
    });
    emitRefresh('refresh_zones');
    res.status(201).json(newZone);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear zona' });
  }
};

export const updateZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, has_sections } = req.body;

    const existing = await prisma.zone.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Zona no encontrada' });
      return;
    }

    const data: { name?: string; has_sections?: boolean } = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        res.status(400).json({ error: 'El nombre es obligatorio' });
        return;
      }
      const clash = await prisma.zone.findFirst({
        where: { name: trimmed, NOT: { id } },
      });
      if (clash) {
        res.status(400).json({ error: 'Ya existe otra zona con ese nombre' });
        return;
      }
      data.name = trimmed;
    }

    if (has_sections !== undefined) {
      data.has_sections = has_sections === true || has_sections === 'true';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const zone = await tx.zone.update({
        where: { id },
        data,
        include: zoneInclude,
      });

      // Al pasar a «Sin secciones», desvincular activos de secciones de esta zona.
      if (data.has_sections === false) {
        await tx.asset.updateMany({
          where: { zone_id: id, zone_section_id: { not: null } },
          data: { zone_section_id: null, section: null },
        });
      }

      return zone;
    });

    emitRefresh('refresh_zones');
    emitRefresh('refresh_assets');
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar zona' });
  }
};

export const deleteZone = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'ADMINISTRADOR') {
      res.status(403).json({ error: 'Solo un administrador puede eliminar zonas' });
      return;
    }

    const id = req.params.id as string;

    const assetInUse = await prisma.asset.findFirst({ where: { zone_id: id } });
    if (assetInUse) {
      res.status(400).json({ error: 'No se puede eliminar la zona porque tiene activos asociados' });
      return;
    }

    const woInUse = await prisma.workOrder.findFirst({ where: { zone_id: id } });
    if (woInUse) {
      res.status(400).json({ error: 'No se puede eliminar la zona porque tiene órdenes asociadas' });
      return;
    }

    await prisma.zone.delete({ where: { id } });
    emitRefresh('refresh_zones');
    res.json({ message: 'Zona eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar zona' });
  }
};

export const createZoneSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const zoneId = req.params.id as string;
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'El nombre de la sección es obligatorio' });
      return;
    }

    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      res.status(404).json({ error: 'Zona no encontrada' });
      return;
    }
    if (!zone.has_sections) {
      res.status(400).json({
        error: 'La zona está en modo «Sin secciones». Activa las secciones antes de agregarlas.',
      });
      return;
    }

    const trimmed = String(name).trim();
    const clash = await prisma.zoneSection.findUnique({
      where: { zone_id_name: { zone_id: zoneId, name: trimmed } },
    });
    if (clash) {
      res.status(400).json({ error: 'Ya existe una sección con ese nombre en la zona' });
      return;
    }

    const section = await prisma.zoneSection.create({
      data: { zone_id: zoneId, name: trimmed },
    });
    emitRefresh('refresh_zones');
    res.status(201).json(section);
  } catch (error: any) {
    console.error(error);
    if (error?.code === 'P2002') {
      res.status(400).json({ error: 'Ya existe una sección con ese nombre en la zona' });
      return;
    }
    res.status(500).json({ error: 'Error al crear sección' });
  }
};

export const updateZoneSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const sectionId = req.params.sectionId as string;
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'El nombre de la sección es obligatorio' });
      return;
    }

    const existing = await prisma.zoneSection.findUnique({ where: { id: sectionId } });
    if (!existing) {
      res.status(404).json({ error: 'Sección no encontrada' });
      return;
    }

    const trimmed = String(name).trim();
    const clash = await prisma.zoneSection.findFirst({
      where: {
        zone_id: existing.zone_id,
        name: trimmed,
        NOT: { id: sectionId },
      },
    });
    if (clash) {
      res.status(400).json({ error: 'Ya existe una sección con ese nombre en la zona' });
      return;
    }

    const letter = sectionEnumFromName(trimmed);

    const updated = await prisma.$transaction(async (tx) => {
      const section = await tx.zoneSection.update({
        where: { id: sectionId },
        data: { name: trimmed },
      });
      // Mantener letra MTTO alineada si el nombre es A–E (o X si deja de serlo).
      await tx.asset.updateMany({
        where: { zone_section_id: sectionId },
        data: { section: letter },
      });
      return section;
    });

    emitRefresh('refresh_zones');
    emitRefresh('refresh_assets');
    res.json(updated);
  } catch (error: any) {
    console.error(error);
    if (error?.code === 'P2002') {
      res.status(400).json({ error: 'Ya existe una sección con ese nombre en la zona' });
      return;
    }
    res.status(500).json({ error: 'Error al actualizar sección' });
  }
};

export const deleteZoneSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const sectionId = req.params.sectionId as string;

    const existing = await prisma.zoneSection.findUnique({ where: { id: sectionId } });
    if (!existing) {
      res.status(404).json({ error: 'Sección no encontrada' });
      return;
    }

    const inUse = await prisma.asset.findFirst({ where: { zone_section_id: sectionId } });
    if (inUse) {
      res.status(400).json({
        error: 'No se puede eliminar la sección porque hay activos que la usan',
      });
      return;
    }

    await prisma.zoneSection.delete({ where: { id: sectionId } });
    emitRefresh('refresh_zones');
    res.json({ message: 'Sección eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar sección' });
  }
};
