import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Asegurarse de que la carpeta exista
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, uniqueSuffix + ext);
  },
});

/** Fotos de OT / portal / inventario / activos: imágenes, máx. 12 MB */
export const IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp|heic|heif)$/i;
/** Activos: imagen o PDF de manual */
export const ASSET_FILE_MIME =
  /^(image\/(jpeg|jpg|png|gif|webp|heic|heif)|application\/pdf)$/i;

export const UPLOAD_FILE_SIZE = 12 * 1024 * 1024;

export const imageFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (IMAGE_MIME.test(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP, HEIC)'));
};

export const assetFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ASSET_FILE_MIME.test(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Solo se permiten imágenes o PDF'));
};

export const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_FILE_SIZE, files: 4 },
  fileFilter: imageFileFilter,
});

/** Multer con carpeta propia (inventario / activos) y mismos límites. */
export function createDiskUploader(
  destDir: string,
  opts?: { allowPdf?: boolean; maxFiles?: number }
) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const disk = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });
  return multer({
    storage: disk,
    limits: { fileSize: UPLOAD_FILE_SIZE, files: opts?.maxFiles ?? 4 },
    fileFilter: opts?.allowPdf ? assetFileFilter : imageFileFilter,
  });
}
