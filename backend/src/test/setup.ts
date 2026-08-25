import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Runs before any test file (and therefore before db.ts / prisma is ever
// imported) via vitest.config.ts's setupFiles. override:true so this wins
// even if something upstream already loaded .env into process.env.
dotenv.config({ path: path.join(__dirname, "../../.env.test"), override: true });

// Safety net: if .env.test is missing or DATABASE_URL didn't come from it,
// fail loudly rather than silently falling back to the real dev/prod
// DATABASE_URL from .env -- tests create and delete real rows.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set after loading .env.test. Copy backend/.env.test.example to " +
      "backend/.env.test and point it at a disposable database before running tests -- " +
      "see the \"Running tests\" section in the README."
  );
}
