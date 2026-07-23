import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma';
import { Role, AssetStatus, AssetKind, Priority, MaintenanceType, ProductionGroup, WorkOrderStatus } from '@prisma/client';
import { generateAssetInternalCode } from '../src/utils/assetCodeGenerator';

async function main() {
  console.log('🔄 Iniciando la generación de datos de prueba aleatorios...');

  // 1. Limpieza de datos antiguos en orden de relaciones
  console.log('🗑️ Limpiando datos existentes...');
  await prisma.inventoryTransaction.deleteMany();
  await prisma.maintenancePlan.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.zone.deleteMany();
  // No borramos Users para no romper auth si hay sesiones activas, o podemos borrarlos:
  // await prisma.user.deleteMany(); // comentado para que no falle con los ya existentes

  // 2. Crear/Verificar usuarios principales
  console.log('👥 Creando usuarios...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fiix.com' },
    update: {},
    create: {
      email: 'admin@fiix.com',
      name: 'Admin User',
      password_hash: passwordHash,
      role: Role.ADMINISTRADOR,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'gestionador@fiix.com' },
    update: {},
    create: {
      email: 'gestionador@fiix.com',
      name: 'Gestionador User',
      password_hash: passwordHash,
      role: Role.GESTIONADOR,
    },
  });

  // Técnicos base
  const tech1 = await prisma.user.upsert({
    where: { email: 'tecnico@fiix.com' },
    update: {},
    create: {
      email: 'tecnico@fiix.com',
      name: 'Juan Técnico',
      password_hash: passwordHash,
      role: Role.TECNICO,
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: 'tecnico2@fiix.com' },
    update: {},
    create: {
      email: 'tecnico2@fiix.com',
      name: 'Carlos López (Tech)',
      password_hash: passwordHash,
      role: Role.TECNICO,
    },
  });

  const tech3 = await prisma.user.upsert({
    where: { email: 'tecnico3@fiix.com' },
    update: {},
    create: {
      email: 'tecnico3@fiix.com',
      name: 'Ana Gómez (Tech)',
      password_hash: passwordHash,
      role: Role.TECNICO,
    },
  });

  const technicians = [tech1, tech2, tech3];

  // 3. Crear Zonas
  console.log('📍 Creando zonas de producción...');
  const zonesData = [
    { name: 'Zona A (Inyección)' },
    { name: 'Zona B (Soplado)' },
    { name: 'Zona C (Envasado)' },
    { name: 'Zona D (Almacén)' },
    { name: 'Zona E (Servicios Auxiliares)' },
  ];

  const zones = [];
  for (const z of zonesData) {
    const zone = await prisma.zone.create({ data: z });
    zones.push(zone);
  }

  // 4. Crear Activos (Assets)
  console.log('⚙️ Creando activos...');
  const assetTemplates = [
    { name: 'Inyectora de Plástico Husky', prefix: 'INY', brands: ['Husky', 'Engel', 'Arburg'] },
    { name: 'Bomba Centrífuga de Enfriamiento', prefix: 'BMB', brands: ['Goulds', 'Grundfos', 'KSB'] },
    { name: 'Compresor de Aire de Tornillo', prefix: 'CMP', brands: ['Ingersoll Rand', 'Atlas Copco', 'Kaeser'] },
    { name: 'Torre de Enfriamiento Industrial', prefix: 'TOW', brands: ['Marley', 'Evapco', 'BAC'] },
    { name: 'Línea de Llenado Rotativa', prefix: 'LLN', brands: ['Krones', 'Sidel', 'KHS'] },
    { name: 'Etiquetadora Automática', prefix: 'ETQ', brands: ['Krones', 'Sidel', 'Pilab'] },
    { name: 'Montacargas Eléctrico 2.5T', prefix: 'MNT', brands: ['Toyota', 'Yale', 'Hyster'] },
    { name: 'Generador Eléctrico de Emergencia', prefix: 'GEN', brands: ['Caterpillar', 'Cummins', 'Kohler'] },
    { name: 'Chiller de Enfriamiento de Agua', prefix: 'CHL', brands: ['Trane', 'Carrier', 'York'] },
    { name: 'Caldera de Vapor', prefix: 'CAL', brands: ['Cleaver-Brooks', 'Babcock', 'Clayton'] },
    { name: 'Sistema de Transportador Banda', prefix: 'TRA', brands: ['Festo', 'Bosch', 'Dorner'] },
    { name: 'Selladora de Cajas', prefix: 'SEL', brands: ['3M', 'Lantech', 'Robopac'] },
  ];

  const assets = [];

  for (let i = 0; i < 15; i++) {
    const template = assetTemplates[i % assetTemplates.length];
    const brand = template.brands[Math.floor(Math.random() * template.brands.length)];
    const model = `M-${Math.floor(100 + Math.random() * 900)}`;
    const serial = `SN-${Math.floor(100000 + Math.random() * 900000)}`;
    const zone = zones[Math.floor(Math.random() * zones.length)];
    
    // Status distribution: 75% OPERATIVO, 15% EN_MANTENIMIENTO, 10% FUERA_DE_SERVICIO
    const rand = Math.random();
    const status = rand < 0.75 ? AssetStatus.OPERATIVO : rand < 0.90 ? AssetStatus.EN_MANTENIMIENTO : AssetStatus.FUERA_DE_SERVICIO;

    const assetName = `${template.name} ${i + 1}`;
    const internal_code = await generateAssetInternalCode({
      name: assetName,
      zoneId: zone.id,
      section: null,
      assetKind: AssetKind.FIJO,
    });

    const asset = await prisma.asset.create({
      data: {
        internal_code,
        name: assetName,
        brand,
        model,
        serial_number: serial,
        description: `Activo crítico en la sección de producción de ${zone.name}`,
        status,
        asset_kind: AssetKind.FIJO,
        zone_id: zone.id,
      },
    });
    assets.push(asset);
  }

  // 5. Crear Órdenes de Trabajo (WorkOrders)
  console.log('📋 Creando órdenes de trabajo de prueba...');
  const orderTitles = {
    [MaintenanceType.CORRECTIVO]: [
      'Falla en motor principal - sobrecalentamiento',
      'Fuga de fluido hidráulico',
      'Rotura de banda transportadora',
      'Sensor de proximidad descalibrado',
      'Cortocircuito en panel de control',
      'Válvula de seguridad gotea',
      'Ruido excesivo en baleros',
      'Pérdida de presión en línea de aire',
    ],
    [MaintenanceType.PREVENTIVO]: [
      'Mantenimiento preventivo mensual - rutina de lubricación',
      'Inspección y limpieza de filtros trimestral',
      'Calibración anual de instrumentos de medición',
      'Revisión general de conexiones eléctricas',
      'Prueba de disparo de generador de emergencia',
      'Limpieza interna de ductos de enfriamiento',
      'Cambio de aceite hidráulico anual',
    ],
    [MaintenanceType.SERVICIO]: [
      'Instalación de nueva fotocelda de seguridad',
      'Reubicación de panel de botonera externa',
      'Pintura y rotulado de zona de seguridad',
      'Adecuación de guardas protectoras metálicas',
      'Tomas de muestras de aceite para análisis',
    ]
  };

  const holdReasons = [
    'En espera de refacción original importada',
    'Falta de disponibilidad del equipo por producción',
    'En espera de especialista externo de soporte de fabricante',
    'Pendiente de autorización de presupuesto para repuesto',
    'Falta de herramienta especializada'
  ];

  const resolutionNotes = [
    'Se realizó el cambio de baleros gastados por unos nuevos. Se lubricó la zona y se probó funcionamiento de forma satisfactoria.',
    'Se detectó cable suelto en regleta de control. Se re-apretó conexión y se limpió panel con solvente dieléctrico. Equipo funcionando.',
    'Se cambió el filtro obstruido por uno nuevo de stock. Se midió diferencial de presión quedando dentro de parámetros normales.',
    'Se localizó la fuga de aceite en sello mecánico. Se reemplazó el retén por uno de repuesto y se rellenó nivel de aceite.',
    'Se ajustó el sensor de proximidad a una distancia de 5mm del actuador. Se realizaron 10 ciclos de prueba exitosos.',
  ];

  const requesters = ['Supervisor Planta', 'Operador Línea 1', 'Ingeniero Calidad', 'Jefe de Turno', 'Auditor de Seguridad'];

  // Crear unas 45 órdenes distribuidas en el tiempo (últimos 30 días)
  const now = new Date();

  for (let i = 0; i < 45; i++) {
    const maintenance_type = Object.keys(orderTitles)[i % 3] as MaintenanceType;
    const titlesList = orderTitles[maintenance_type];
    const title = titlesList[Math.floor(Math.random() * titlesList.length)] + ` (Ref #${i + 100})`;

    const asset = assets[Math.floor(Math.random() * assets.length)];
    const priority = Math.random() < 0.2 ? Priority.URGENTE : Math.random() < 0.7 ? Priority.NORMAL : Priority.BAJO;
    
    // Status distribution
    const statusRand = Math.random();
    let status: WorkOrderStatus;
    if (statusRand < 0.45) {
      status = WorkOrderStatus.FINALIZADO;
    } else if (statusRand < 0.70) {
      status = WorkOrderStatus.PENDIENTE;
    } else if (statusRand < 0.85) {
      status = WorkOrderStatus.EN_PROCESO;
    } else if (statusRand < 0.95) {
      status = WorkOrderStatus.EN_ESPERA;
    } else {
      status = WorkOrderStatus.ANULADO;
    }

    const machine_stopped = Math.random() < 0.35; // 35% de probabilidad de paro de máquina
    const group = [ProductionGroup.A, ProductionGroup.B, ProductionGroup.C, ProductionGroup.D, ProductionGroup.NA][Math.floor(Math.random() * 5)];

    // Generar fechas
    const daysAgo = Math.floor(Math.random() * 30);
    const created_at = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 12 * 60 * 60 * 1000));
    
    let completed_at = null;
    let started_at = null;
    let hold_reason = null;
    let resNotes = null;
    let accumulated_time_ms = 0;

    if (status === WorkOrderStatus.EN_PROCESO || status === WorkOrderStatus.EN_ESPERA || status === WorkOrderStatus.FINALIZADO) {
      // Comenzada unas horas después de ser creada
      started_at = new Date(created_at.getTime() + Math.floor(1 * 60 * 60 * 1000 + Math.random() * 4 * 60 * 60 * 1000));
    }

    if (status === WorkOrderStatus.EN_ESPERA) {
      hold_reason = holdReasons[Math.floor(Math.random() * holdReasons.length)];
    }

    if (status === WorkOrderStatus.FINALIZADO) {
      const repairDurationHours = Math.floor(1 + Math.random() * 5);
      completed_at = new Date(started_at!.getTime() + repairDurationHours * 60 * 60 * 1000);
      accumulated_time_ms = repairDurationHours * 60 * 60 * 1000;
      resNotes = resolutionNotes[Math.floor(Math.random() * resolutionNotes.length)];
    }

    // Technicians assignment (1 or 2 techs assigned to EN_PROCESO, EN_ESPERA, or FINALIZADO)
    const assignedTechs = [];
    if (status !== WorkOrderStatus.PENDIENTE && status !== WorkOrderStatus.ANULADO) {
      const numTechs = Math.random() < 0.7 ? 1 : 2;
      const shuffledTechs = [...technicians].sort(() => 0.5 - Math.random());
      for (let t = 0; t < numTechs; t++) {
        assignedTechs.push({ id: shuffledTechs[t].id });
      }
    }

    await prisma.workOrder.create({
      data: {
        title,
        description: `Mantenimiento requerido para el activo ${asset.name}. Revisar condiciones y reportar hallazgos.`,
        asset_id: asset.id,
        zone_id: asset.zone_id,
        priority,
        maintenance_type,
        machine_stopped,
        requester_name: requesters[Math.floor(Math.random() * requesters.length)],
        production_group: group,
        status,
        hold_reason,
        started_at,
        accumulated_time_ms,
        resolution_notes: resNotes,
        created_by_id: admin.id,
        created_at,
        updated_at: completed_at || created_at,
        completed_at,
        assigned_technicians: {
          connect: assignedTechs,
        },
      },
    });
  }

  console.log('✅ ¡Poblado de datos aleatorios finalizado con éxito!');
  console.log('📊 Resumen de datos generados:');
  console.log(` - Usuarios técnicos agregados: ${technicians.length}`);
  console.log(` - Zonas creadas: ${zones.length}`);
  console.log(` - Activos (Assets) creados: ${assets.length}`);
  console.log(` - Órdenes de trabajo creadas: 45`);
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando el poblamiento:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
