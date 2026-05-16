-- New enums
CREATE TYPE "ContentCategory" AS ENUM ('SOCIAL_POST', 'REEL', 'VIDEO', 'AD_CREATIVE', 'BANNER', 'THUMBNAIL', 'BRANDING', 'OTHER');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'NEEDS_REVISION', 'PUBLISHED');
CREATE TYPE "ProjectPhase" AS ENUM ('DISCOVERY', 'PLANNING', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'DEPLOYMENT', 'MAINTENANCE');

-- ClientPortalUser
CREATE TABLE "client_portal_users" (
    "id" TEXT NOT NULL, "email" TEXT NOT NULL, "password" TEXT NOT NULL,
    "clientId" TEXT NOT NULL, "name" TEXT NOT NULL, "avatar" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true, "lastLogin" TIMESTAMP(3),
    "resetToken" TEXT, "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_portal_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_portal_users_email_key" ON "client_portal_users"("email");
CREATE UNIQUE INDEX "client_portal_users_clientId_key" ON "client_portal_users"("clientId");
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProjectUpdate
CREATE TABLE "project_updates" (
    "id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "title" TEXT NOT NULL,
    "content" TEXT NOT NULL, "phase" "ProjectPhase", "imageUrl" TEXT, "fileUrl" TEXT,
    "postedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_postedById_fkey"
  FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- UpdateComment
CREATE TABLE "update_comments" (
    "id" TEXT NOT NULL, "updateId" TEXT NOT NULL, "content" TEXT NOT NULL,
    "isClient" BOOLEAN NOT NULL DEFAULT false, "authorName" TEXT NOT NULL, "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "update_comments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "update_comments" ADD CONSTRAINT "update_comments_updateId_fkey"
  FOREIGN KEY ("updateId") REFERENCES "project_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ContentDelivery
CREATE TABLE "content_deliveries" (
    "id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "title" TEXT NOT NULL,
    "description" TEXT, "fileUrl" TEXT, "previewUrl" TEXT, "externalLink" TEXT,
    "category" "ContentCategory" NOT NULL DEFAULT 'OTHER',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "uploadedById" TEXT NOT NULL, "clientComment" TEXT, "revisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_deliveries_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "content_deliveries" ADD CONSTRAINT "content_deliveries_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_deliveries" ADD CONSTRAINT "content_deliveries_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ClientNotification
CREATE TABLE "client_notifications" (
    "id" TEXT NOT NULL, "clientPortalUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL, "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false, "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_notifications_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "client_notifications" ADD CONSTRAINT "client_notifications_clientPortalUserId_fkey"
  FOREIGN KEY ("clientPortalUserId") REFERENCES "client_portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClientKpiConfig
CREATE TABLE "client_kpi_configs" (
    "id" TEXT NOT NULL, "clientId" TEXT NOT NULL,
    "metaToken" TEXT, "metaAdAccountId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_kpi_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_kpi_configs_clientId_key" ON "client_kpi_configs"("clientId");
ALTER TABLE "client_kpi_configs" ADD CONSTRAINT "client_kpi_configs_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
