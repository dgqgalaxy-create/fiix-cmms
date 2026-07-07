import prisma from './config/prisma';

const activities = [
  "Sistema de vacío (verificar presiones, ruido, sobrecalentamiento, humo).",
  "Verificar que los equipos y periféricos estén completos.",
  "Verificar presión y caudal del sistema de agua (líneas generales y auxiliares).",
  "Verificar los niveles de agua a las tinas de enfriamiento del cañón.",
  "Nivel de agua en bomba de anillo líquido.",
  "Inspección visual de todos los tableros eléctricos (puertas, ventiladores, lámparas).",
  "Verificar correcto funcionamiento de las turbinas de alimentación de las máquinas.",
  "Verificar enfriamiento de minisplits en cuartos de control principales.",
  "Revisión de niveles de anticongelante a intercambiadores de calor de calandras.",
  "Revisión del correcto funcionamiento de los molinos de refil.",
  "Verificar funcionamiento del sistema de autollenado para silicón o antiestático.",
  "Inspección de presencia fugas de aceite en todos los sistemas hidráulicos.",
  "Inspección de presencia de fugas de aire en todos los sistemas neumáticos.",
  "Verificar ruidos o sonidos anormales de baleros, rodillos, chumaceras y motores.",
  "Temperatura del estator del motor principal.",
  "Temperatura de la tapa frontal del motor principal.",
  "Temperatura de caja del balero de carga en las revolvedoras y lubricar balero inferior.",
  "Verificar nivel de agua en torres enfriamiento, purgas habilitadas y tanque de salmuera.",
  "Verificación de fugas en sellos mecánicos de bombas y tuberías en general.",
  "Verificación del correcto funcionamiento de los compresores, purgar.",
  "Tomar lecturas del estado del agua de las torres de enfriamiento.",
  "Verificación del estado y limpieza del área de residuos peligrosos.",
  "Revisar correcto funcionamiento del equipo de osmosis inversa y nivel de agua.",
  "Revisión de orden y limpieza del cuarto de productos químicos.",
  "Revisión de orden y limpieza del taller.",
  "Revisar equipos tengan sus guardas (acrílicos, tapas, rejas) instaladas.",
  "Revision visual del cable del polipasto (que no se encuentren filamentos rotos).",
  "Revisar las canaletas de cableado cuenten con sus tapas puestas y fijas."
];

async function main() {
  console.log('Iniciando importación del Checklist Diario...');
  
  await prisma.checklistActivity.deleteMany({});
  
  for (let i = 0; i < activities.length; i++) {
    await prisma.checklistActivity.create({
      data: {
        name: activities[i],
        order: i + 1,
        is_active: true
      }
    });
  }
  
  console.log(`¡Importación finalizada! Se crearon ${activities.length} actividades.`);
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
