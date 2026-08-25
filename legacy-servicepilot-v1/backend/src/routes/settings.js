import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function toPublicSettings(user) {
  return {
    businessName: user.businessName,
    logoUrl: user.logoUrl,
    brandColor: user.brandColor,
    address: user.address,
    phone: user.phone,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    res.json(toPublicSettings(user));
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const { businessName, logoUrl, brandColor, address, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { businessName, logoUrl, brandColor, address, phone },
    });
    res.json(toPublicSettings(user));
  } catch (err) {
    next(err);
  }
});

export default router;
