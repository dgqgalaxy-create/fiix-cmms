/** Client-side image resize/compress to reduce mobile memory pressure and upload size. */

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.72;
const SKIP_IF_UNDER_BYTES = 350_000;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen'))),
      type,
      quality
    );
  });
}

/**
 * Resizes and re-encodes as JPEG when the file is large or oversized in pixels.
 * Returns the original file if compression is unnecessary or fails.
 */
export async function compressImageFile(
  file: File,
  options?: { maxEdge?: number; quality?: number }
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options?.quality ?? DEFAULT_QUALITY;

  try {
    const img = await loadImageFromFile(file);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const needsResize = longest > maxEdge;
    const needsReencode = file.size > SKIP_IF_UNDER_BYTES || file.type === 'image/png' || file.type === 'image/webp';

    if (!needsResize && !needsReencode) return file;

    const scale = needsResize ? maxEdge / longest : 1;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);

    // Keep original if somehow larger after encode
    if (blob.size >= file.size && !needsResize) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}
