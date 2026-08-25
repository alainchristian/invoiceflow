import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = ["active", "completed", "archived"];

async function findOwnedClient(clientId, ownerId) {
  return prisma.client.findFirst({ where: { id: clientId, ownerId } });
}

async function findOwnedProject(projectId, ownerId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true },
  });
  if (!project || project.client.ownerId !== ownerId) return null;
  return project;
}

async function findOwnedTask(taskId, ownerId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { client: true } } },
  });
  if (!task || task.project.client.ownerId !== ownerId) return null;
  return task;
}

router.post("/", async (req, res, next) => {
  try {
    const { clientId, title } = req.body;
    if (!clientId || !title) {
      return res.status(400).json({ error: "clientId and title are required" });
    }

    const client = await findOwnedClient(clientId, req.userId);
    if (!client) return res.status(404).json({ error: "Client not found" });

    const project = await prisma.project.create({ data: { clientId, title } });
    res.status(201).json(project);
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

    const project = await findOwnedProject(req.params.id, req.userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/tasks", async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const project = await findOwnedProject(req.params.id, req.userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const task = await prisma.task.create({
      data: { title, projectId: req.params.id },
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

router.patch("/tasks/:taskId", async (req, res, next) => {
  try {
    const { done } = req.body;

    const task = await findOwnedTask(req.params.taskId, req.userId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const updated = await prisma.task.update({
      where: { id: req.params.taskId },
      data: { done },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
