-- CreateEnum
CREATE TYPE "StatementRecipients" AS ENUM ('ALL', 'OVERDUE_ONLY');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "nextStatementRunAt" TIMESTAMP(3),
ADD COLUMN     "statementFrequencyDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "statementRecipients" "StatementRecipients" NOT NULL DEFAULT 'OVERDUE_ONLY',
ADD COLUMN     "statementsEnabled" BOOLEAN NOT NULL DEFAULT false;
