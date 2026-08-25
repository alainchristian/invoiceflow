import { Router } from "express";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { checkOverdueInvoices, applyLateFees } from "./scheduler.js";

const router = Router();

router.use(requireAuth, requireOrgMember);

// Manually triggers the overdue check (and late-fee application), scoped to
// the caller's own org (not a global sweep) -- useful for testing/QA without
// waiting for the hourly poll.
router.post("/run-now", async (req: AuthedRequest, res, next) => {
  try {
    const now = new Date();
    const checked = await checkOverdueInvoices(now, req.organizationId as string);
    const lateFeesApplied = await applyLateFees(now, req.organizationId as string);
    res.json({ checked, lateFeesApplied });
  } catch (err) {
    next(err);
  }
});

export default router;
