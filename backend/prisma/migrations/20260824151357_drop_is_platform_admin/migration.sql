-- Safe: every isPlatformAdmin=true row was backfilled into the new
-- platformRole column (SUPER_ADMIN) before this migration was created.
ALTER TABLE "User" DROP COLUMN "isPlatformAdmin";
