CREATE TABLE "DeveloperAccessLock" (
 "user_id" UUID NOT NULL, "failed_attempts" INTEGER NOT NULL DEFAULT 0, "locked_until" TIMESTAMP(3),
 CONSTRAINT "DeveloperAccessLock_pkey" PRIMARY KEY ("user_id"),
 CONSTRAINT "DeveloperAccessLock_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "PurchaseReceipt" (
 "request_id" TEXT NOT NULL, "purchase_order_id" UUID NOT NULL, "user_id" UUID NOT NULL,
 "quantities" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("request_id"),
 CONSTRAINT "PurchaseReceipt_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PurchaseReceipt_purchase_order_id_created_at_idx" ON "PurchaseReceipt"("purchase_order_id", "created_at");
