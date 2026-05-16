-- CreateTable: company_services (do this first, before dropping the enum)
CREATE TABLE "company_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_services_slug_key" ON "company_services"("slug");

-- Seed initial services
INSERT INTO "company_services" ("id", "name", "slug", "active", "order", "createdAt", "updatedAt") VALUES
('clsvc_smm001', 'Social Media Management', 'SOCIAL_MEDIA_MANAGEMENT', true, 1, NOW(), NOW()),
('clsvc_seo001', 'SEO',                     'SEO',                     true, 2, NOW(), NOW()),
('clsvc_ppc001', 'PPC Ads',                 'PPC_ADS',                 true, 3, NOW(), NOW()),
('clsvc_cnt001', 'Content Creation',        'CONTENT_CREATION',        true, 4, NOW(), NOW()),
('clsvc_web001', 'Web Design',              'WEB_DESIGN',              true, 5, NOW(), NOW()),
('clsvc_brd001', 'Branding',               'BRANDING',                true, 6, NOW(), NOW()),
('clsvc_fll001', 'Full Service',            'FULL_SERVICE',             true, 7, NOW(), NOW());

-- AlterTable: Convert service from enum to text (preserves existing data)
ALTER TABLE "clients" ALTER COLUMN "service" TYPE TEXT USING "service"::text;

-- AlterTable: Convert service from enum to text (preserves existing data)
ALTER TABLE "leads" ALTER COLUMN "service" TYPE TEXT USING "service"::text;

-- DropEnum
DROP TYPE IF EXISTS "Service";
