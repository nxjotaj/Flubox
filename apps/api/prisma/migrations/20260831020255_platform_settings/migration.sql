-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "pickupAddress" JSONB NOT NULL DEFAULT '{}',
    "pixMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "pixKey" TEXT NOT NULL DEFAULT '',
    "pixBeneficiary" TEXT NOT NULL DEFAULT '',
    "pixCity" TEXT NOT NULL DEFAULT '',
    "pixProvider" TEXT NOT NULL DEFAULT 'SIMULATED',
    "pixApiUrl" TEXT NOT NULL DEFAULT '',
    "pixApiTokenEncrypted" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
