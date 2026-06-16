import { jsPDF } from 'jspdf';
import type { WorkOrder } from '../api/workOrders';
import { BACKEND_URL } from '../api/axios';

const loadImgAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = () => reject('Error loading image');
    img.src = url;
  });
};

export const generateWorkOrderPDF = async (workOrder: WorkOrder) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Encabezado
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("REPORTE DE MANTENIMIENTO", 20, 20);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Folio: WO-${(workOrder.folio || 0).toString().padStart(4, '0')}`, 20, 30);
  doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 140, 30);
  
  doc.line(20, 35, 190, 35);

  // Información del Activo
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Información del Activo", 20, 45);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Activo: ${workOrder.asset?.name || 'Desconocido'}`, 20, 52);
  doc.text(`ID: ${workOrder.asset?.id || 'N/A'}`, 20, 58);
  doc.text(`Zona: ${workOrder.zone?.name || 'N/A'}`, 20, 64);

  // Detalles de la Orden
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Detalles de la Orden", 110, 45);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Prioridad: ${workOrder.priority}`, 110, 52);
  doc.text(`Tipo: ${workOrder.maintenance_type}`, 110, 58);
  doc.text(`Solicitante: ${workOrder.requester_name || 'N/A'}`, 110, 64);
  if (workOrder.machine_stopped) {
    doc.setTextColor(200, 0, 0);
    doc.text("¡Hubo Paro de Máquina!", 110, 70);
    doc.setTextColor(0, 0, 0);
  }

  doc.line(20, 75, 190, 75);

  // Descripción
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Descripción del Problema:", 20, 85);
  doc.setFont("helvetica", "normal");
  const descLines = doc.splitTextToSize(workOrder.description || 'Sin descripción', 170);
  doc.text(descLines, 20, 92);
  
  const descHeight = descLines.length * 5;
  let nextY = 92 + descHeight + 10;

  // Resolución
  doc.setFont("helvetica", "bold");
  doc.text("Trabajo Realizado (Resolución):", 20, nextY);
  doc.setFont("helvetica", "normal");
  const resLines = doc.splitTextToSize(workOrder.resolution_notes || 'Sin notas', 170);
  doc.text(resLines, 20, nextY + 7);
  
  nextY += 7 + (resLines.length * 5) + 10;

  // Técnicos y Tiempos
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Técnicos Asignados:", 20, nextY);
  doc.setFont("helvetica", "normal");
  const techs = workOrder.assigned_technicians && workOrder.assigned_technicians.length > 0 
    ? workOrder.assigned_technicians.map(t => t.name).join(', ') 
    : 'Ninguno';
  const techLines = doc.splitTextToSize(techs, 80);
  doc.text(techLines, 20, nextY + 7);

  doc.setFont("helvetica", "bold");
  doc.text("Registro de Tiempos:", 110, nextY);
  doc.setFont("helvetica", "normal");
  doc.text(`Inicio: ${workOrder.started_at ? new Date(workOrder.started_at).toLocaleString() : 'N/A'}`, 110, nextY + 7);
  doc.text(`Fin: ${workOrder.completed_at ? new Date(workOrder.completed_at).toLocaleString() : 'N/A'}`, 110, nextY + 13);

  nextY += 25;

  // Firmas
  if (nextY > 230) {
    doc.addPage();
    nextY = 20;
  }

  doc.line(20, nextY, 190, nextY);
  nextY += 10;
  
  doc.setFont("helvetica", "bold");
  doc.text("Firmas de Conformidad", 20, nextY);
  
  nextY += 15;

  if (workOrder.signature_clean_area && typeof workOrder.signature_clean_area === 'string') {
    if (workOrder.signature_clean_area.startsWith('data:image')) {
      doc.addImage(workOrder.signature_clean_area, 'PNG', 30, nextY, 60, 25);
    } else {
      doc.text(workOrder.signature_clean_area, 30, nextY + 15);
    }
  }
  doc.line(30, nextY + 30, 90, nextY + 30);
  doc.setFontSize(10);
  doc.text("Liberación de Área Limpia", 35, nextY + 35);

  if (workOrder.signature_delivery && typeof workOrder.signature_delivery === 'string') {
    if (workOrder.signature_delivery.startsWith('data:image')) {
      doc.addImage(workOrder.signature_delivery, 'PNG', 120, nextY, 60, 25);
    } else {
      doc.text(workOrder.signature_delivery, 120, nextY + 15);
    }
  }
  doc.line(120, nextY + 30, 180, nextY + 30);
  doc.text("Entrega de Trabajo", 135, nextY + 35);

  nextY += 45;

  // Fotos
  if (workOrder.before_image_url || workOrder.after_image_url) {
    if (nextY > 180) {
      doc.addPage();
      nextY = 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Evidencia Fotográfica", 20, nextY);
    nextY += 10;

    try {
      if (workOrder.before_image_url) {
        doc.text("Antes", 20, nextY);
        const beforeBase64 = await loadImgAsBase64(`${BACKEND_URL}${workOrder.before_image_url}`);
        doc.addImage(beforeBase64, 'JPEG', 20, nextY + 5, 80, 60);
      }
      
      if (workOrder.after_image_url) {
        doc.text("Después", 110, nextY);
        const afterBase64 = await loadImgAsBase64(`${BACKEND_URL}${workOrder.after_image_url}`);
        doc.addImage(afterBase64, 'JPEG', 110, nextY + 5, 80, 60);
      }
    } catch (err) {
      console.warn("Could not load images for PDF", err);
      doc.setFontSize(10);
      doc.setTextColor(200, 0, 0);
      doc.text("(Algunas imágenes no se pudieron cargar en el PDF debido a restricciones de red)", 20, nextY + 70);
      doc.setTextColor(0, 0, 0);
    }
  }

  doc.save(`WO-${(workOrder.folio || 0).toString().padStart(4, '0')}.pdf`);
};
