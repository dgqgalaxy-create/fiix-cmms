-- Add OBSERVADOR role (read-only + messaging)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OBSERVADOR';
