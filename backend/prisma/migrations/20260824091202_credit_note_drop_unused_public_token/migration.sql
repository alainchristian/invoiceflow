/*
  Warnings:

  - You are about to drop the column `publicToken` on the `CreditNote` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CreditNote_publicToken_key";

-- AlterTable
ALTER TABLE "CreditNote" DROP COLUMN "publicToken";
