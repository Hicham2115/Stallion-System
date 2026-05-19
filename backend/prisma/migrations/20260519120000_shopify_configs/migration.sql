DO $$
BEGIN
    IF to_regclass('"crm_orders"') IS NOT NULL THEN
        ALTER TABLE "crm_orders" ADD COLUMN IF NOT EXISTS "shopifyOrderId" TEXT;
        ALTER TABLE "crm_orders" ADD COLUMN IF NOT EXISTS "shopifyStore" TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "shopify_configs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_configs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shopify_configs_clientId_fkey'
    ) THEN
        ALTER TABLE "shopify_configs" ADD CONSTRAINT "shopify_configs_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
