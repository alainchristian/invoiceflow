import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      where: { ownerId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(clients);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
      include: {
        projects: { include: { tasks: true } },
        proposals: true,
        invoices: true,
      },
    });
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, email, company, notes } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const client = await prisma.client.create({
      data: { name, email, company, notes, ownerId: req.userId },
    });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: "Client not found" });

    const { name, email, company, notes } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { name, email, company, notes },
    });
    res.json(client);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: "Client not found" });

    await prisma.client.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
