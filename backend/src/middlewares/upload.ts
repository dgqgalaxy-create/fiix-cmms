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

/** Fotos de OT / portal público: imágenes, máx. 12 MB */
const IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp|heic|heif)$/i;

export const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP, HEIC)'));
  },
});
