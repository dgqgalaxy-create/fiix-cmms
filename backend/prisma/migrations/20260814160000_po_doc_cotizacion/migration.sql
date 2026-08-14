-- Cotización como tipo de adjunto en órdenes de compra (además de SP / OC / Otro).
ALTER TYPE "PurchaseOrderDocType" ADD VALUE IF NOT EXISTS 'COTIZACION';
