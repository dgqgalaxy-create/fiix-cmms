import { Request, Response } from 'express';
import prisma from '../config/prisma';
import type { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/authMiddleware';
import { writeAuditLog } from '../utils/auditLog';
import { emitRefresh } from '../utils/socket';

const ENTITIES = ['WORK_ORDER', 'ASSET', 'ITEM'] as const;
const FIELD_TYPES = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN'] as const;

type Entity = (typeof ENTITIES)[number];
type FieldType = (typeof FIELD_TYPES)[number];

function parseEntity(value: unknown): Entity | null {
  const entity = String(value ?? '').toUpperCase();
  return (ENTITIES as readonly string[]).includes(entity) ? (entity as Entity) : null;
}

function slugifyKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'campo';
}

/** GET /api/custom-fields?entity=WORK_ORDER — definiciones (sin filtrar si no hay entity). */
export const getCustomFields = async (req: Request, res: Response): Promise<void> => {
  try {
    const entity = req.query.entity ? parseEntity(req.query.entity) : null;
    if (req.query.entity && !entity) {
      res.status(400).json({ error: 'Entidad no válida' });
      return;
    }
    const fields = await prisma.customFieldDefinition.findMany({
      where: entity ? { entity } : {},
      orderBy: [{ entity: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
    });
    res.json(fields);
  } catch (error) {
    console.error('Error listando campos personalizados:', error);
    res.status(500).json({ error: 'No se pudieron obtener los campos' });
  }
};

/** POST /api/custom-fields — { entity, label, key?, field_type?, options?, required? } */
export const createCustomField = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entity = parseEntity(req.body?.entity);
    const label = String(req.body?.label ?? '').trim().slice(0, 80);
    const fieldType = String(req.body?.field_type ?? 'TEXT').toUpperCase() as FieldType;

    if (!entity) {
      res.status(400).json({ error: 'La entidad es obligatoria (WORK_ORDER, ASSET o ITEM).' });
      return;
    }
    if (!label) {
      res.status(400).json({ error: 'Escribe el nombre del campo.' });
      return;
    }
    if (!(FIELD_TYPES as readonly string[]).includes(fieldType)) {
      res.status(400).json({ error: 'Tipo de campo no válido.' });
      return;
    }

    let key = typeof req.body?.key === 'string' && req.body.key.trim()
      ? slugifyKey(req.body.key)
      : slugifyKey(label);

    const existing = await prisma.customFieldDefinition.findUnique({
      where: { entity_key: { entity, key } },
    });
    if (existing) {
      // Si la clave está tomada, se agrega un sufijo numérico.
      let suffix = 2;
      while (await prisma.customFieldDefinition.findUnique({ where: { entity_key: { entity, key: `${key}_${suffix}` } } })) {
        suffix += 1;
      }
      key = `${key}_${suffix}`;
    }

    const options = fieldType === 'SELECT' && Array.isArray(req.body?.options)
      ? req.body.options
          .map((option: any) => ({
            value: String(option?.value ?? option ?? '').trim(),
            label: String(option?.label ?? option ?? '').trim(),
          }))
          .filter((option: { value: string; label: string }) => option.value && option.label)
      : null;

    if (fieldType === 'SELECT' && (!options || options.length === 0)) {
      res.status(400).json({ error: 'Un campo de lista necesita al menos una opción.' });
      return;
    }

    const maxOrder = await prisma.customFieldDefinition.aggregate({
      where: { entity },
      _max: { sort_order: true },
    });

    const created = await prisma.customFieldDefinition.create({
      data: {
        entity,
        key,
        label,
        field_type: fieldType,
        options: options ?? undefined,
        required: Boolean(req.body?.required),
        sort_order: (maxOrder._max.sort_order ?? 0) + 1,
      },
    });

    await writeAuditLog({
      userId: req.user?.userId,
      action: 'CREATE_CUSTOM_FIELD',
      entity: 'custom_field',
      entityId: created.id,
      summary: `Campo personalizado «${created.label}» (${created.entity})`,
    });
    emitRefresh('refresh_custom_fields');
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando campo personalizado:', error);
    res.status(500).json({ error: 'No se pudo crear el campo' });
  }
};

/** PUT /api/custom-fields/:id */
export const updateCustomField = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const field = await prisma.customFieldDefinition.findUnique({ where: { id } });
    if (!field) {
      res.status(404).json({ error: 'Campo no encontrado' });
      return;
    }

    const data: {
      label?: string;
      field_type?: FieldType;
      required?: boolean;
      is_active?: boolean;
      sort_order?: number;
    } = {};
    let optionsUpdate: Prisma.InputJsonValue | undefined;
    if (typeof req.body?.label === 'string' && req.body.label.trim()) {
      data.label = req.body.label.trim().slice(0, 80);
    }
    if (typeof req.body?.field_type === 'string') {
      const fieldType = req.body.field_type.toUpperCase();
      if ((FIELD_TYPES as readonly string[]).includes(fieldType)) {
        data.field_type = fieldType as FieldType;
      }
    }
    if (Array.isArray(req.body?.options)) {
      optionsUpdate = req.body.options
        .map((option: any) => ({
          value: String(option?.value ?? option ?? '').trim(),
          label: String(option?.label ?? option ?? '').trim(),
        }))
        .filter((option: { value: string; label: string }) => option.value && option.label);
    }
    if (typeof req.body?.required === 'boolean') data.required = req.body.required;
    if (typeof req.body?.is_active === 'boolean') data.is_active = req.body.is_active;
    if (Number.isFinite(Number(req.body?.sort_order))) data.sort_order = Number(req.body.sort_order);

    const updated = await prisma.customFieldDefinition.update({
      where: { id },
      data: optionsUpdate !== undefined ? { ...data, options: optionsUpdate } : data,
    });
    emitRefresh('refresh_custom_fields');
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando campo personalizado:', error);
    res.status(500).json({ error: 'No se pudo actualizar el campo' });
  }
};

/** DELETE /api/custom-fields/:id — elimina también sus valores. */
export const deleteCustomField = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const field = await prisma.customFieldDefinition.findUnique({ where: { id } });
    if (!field) {
      res.status(404).json({ error: 'Campo no encontrado' });
      return;
    }
    await prisma.customFieldDefinition.delete({ where: { id } });
    await writeAuditLog({
      userId: req.user?.userId,
      action: 'DELETE_CUSTOM_FIELD',
      entity: 'custom_field',
      entityId: id,
      summary: `Campo personalizado eliminado: ${field.label} (${field.entity})`,
    });
    emitRefresh('refresh_custom_fields');
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando campo personalizado:', error);
    res.status(500).json({ error: 'No se pudo eliminar el campo' });
  }
};

/** GET /api/custom-fields/values/:entity/:entityId */
export const getCustomFieldValues = async (req: Request, res: Response): Promise<void> => {
  try {
    const entity = parseEntity(req.params.entity);
    const entityId = req.params.entityId as string;
    if (!entity) {
      res.status(400).json({ error: 'Entidad no válida' });
      return;
    }

    const [fields, values] = await Promise.all([
      prisma.customFieldDefinition.findMany({
        where: { entity, is_active: true },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      }),
      prisma.customFieldValue.findMany({ where: { entity_id: entityId } }),
    ]);

    const byField = new Map(values.map((value) => [value.field_id, value.value]));
    res.json({
      fields: fields.map((field) => ({
        ...field,
        value: byField.get(field.id) ?? null,
      })),
    });
  } catch (error) {
    console.error('Error obteniendo valores de campos:', error);
    res.status(500).json({ error: 'No se pudieron obtener los valores' });
  }
};

/** PUT /api/custom-fields/values/:entity/:entityId — { values: { [key]: valor } } */
export const saveCustomFieldValues = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entity = parseEntity(req.params.entity);
    const entityId = req.params.entityId as string;
    if (!entity) {
      res.status(400).json({ error: 'Entidad no válida' });
      return;
    }

    const incoming = (req.body?.values && typeof req.body.values === 'object')
      ? req.body.values as Record<string, unknown>
      : {};

    const fields = await prisma.customFieldDefinition.findMany({
      where: { entity, is_active: true },
    });

    const missing: string[] = [];
    const operations = [];

    for (const field of fields) {
      const raw = incoming[field.key];
      const empty = raw === undefined || raw === null || String(raw).trim() === '';

      if (field.required && empty) {
        missing.push(field.label);
        continue;
      }
      if (empty) {
        operations.push(prisma.customFieldValue.deleteMany({
          where: { field_id: field.id, entity_id: entityId },
        }));
        continue;
      }

      const value = String(raw).slice(0, 2000);
      operations.push(prisma.customFieldValue.upsert({
        where: { field_id_entity_id: { field_id: field.id, entity_id: entityId } },
        update: { value },
        create: { field_id: field.id, entity_id: entityId, value },
      }));
    }

    if (missing.length > 0) {
      res.status(400).json({ error: `Faltan campos obligatorios: ${missing.join(', ')}` });
      return;
    }

    await prisma.$transaction(operations);
    emitRefresh('refresh_custom_fields');
    res.json({ success: true, saved: operations.length });
  } catch (error) {
    console.error('Error guardando campos personalizados:', error);
    res.status(500).json({ error: 'No se pudieron guardar los campos' });
  }
};
