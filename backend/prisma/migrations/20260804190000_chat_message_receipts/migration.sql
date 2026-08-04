-- Recibos de entrega/lectura por destinatario (estilo WhatsApp)
CREATE TABLE "ChatMessageReceipt" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),

    CONSTRAINT "ChatMessageReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatMessageReceipt_message_id_user_id_key" ON "ChatMessageReceipt"("message_id", "user_id");
CREATE INDEX "ChatMessageReceipt_user_id_idx" ON "ChatMessageReceipt"("user_id");
CREATE INDEX "ChatMessageReceipt_message_id_idx" ON "ChatMessageReceipt"("message_id");

ALTER TABLE "ChatMessageReceipt" ADD CONSTRAINT "ChatMessageReceipt_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessageReceipt" ADD CONSTRAINT "ChatMessageReceipt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
