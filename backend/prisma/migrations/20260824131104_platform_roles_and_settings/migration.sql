-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPPORT_ADMIN');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PLATFORM_MESSAGE';

-- AlterTable
ALTER TABLE "AdminAuditLog" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "platformRole" "PlatformRole";

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "platformName" TEXT NOT NULL DEFAULT 'InvoiceFlow',
    "supportEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
