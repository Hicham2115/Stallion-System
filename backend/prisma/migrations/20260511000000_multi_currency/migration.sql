-- AlterTable: add country and preferredCurrency to clients
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "preferred_currency" TEXT NOT NULL DEFAULT 'MAD';

-- CreateTable: exchange_rates
CREATE TABLE IF NOT EXISTS "exchange_rates" (
    "id" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL,
    "target_currency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_base_currency_target_currency_key" ON "exchange_rates"("base_currency", "target_currency");
