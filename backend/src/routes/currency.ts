import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { getRatesCache, syncRates } from "../lib/currency";

const router = Router();

// GET /api/currency/rates — public
router.get(
  "/rates",
  async (_req: AuthRequest, res: Response): Promise<void> => {
    res.json(getRatesCache());
  },
);

// POST /api/currency/sync — admin only
router.post(
  "/sync",
  authenticate,
  requireRole("ADMIN"),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    await syncRates();
    res.json({ message: "Rates synced", rates: getRatesCache() });
  },
);

export default router;
