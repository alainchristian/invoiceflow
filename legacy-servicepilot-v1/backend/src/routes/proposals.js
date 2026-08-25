import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = ["draft", "sent", "signed", "declined"];

router.get("/", async (req, res, next) => {
  try {
    const proposals = await prisma.proposal.findMany({
      where: { ownerId: req.userId },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(proposals);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { title, content, amount, clientId } = req.body;
    if (!title || amount === undefined || !clientId) {
      return res.status(400).json({ error: "title, amount, and clientId are required" });
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, ownerId: req.userId },
    });
    if (!client) return res.status(404).json({ error: "Client not found" });

    const proposal = await prisma.proposal.create({
      data: {
        title,
        content: content ?? "",
        amount,
        clientId,
        ownerId: req.userId,
      },
    });
    res.status(201).json(proposal);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
    }

    const existing = await prisma.proposal.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: "Proposal not found" });

    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: {
        status,
        signedAt: status === "signed" ? new Date() : existing.signedAt,
      },
    });
    res.json(proposal);
  } catch (err) {
    next(err);
  }
});

export default router;
