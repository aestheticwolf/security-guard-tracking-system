import { Router } from "express";
import {
  createGuard,
  deleteGuard,
  getGuards,
  getLiveFeed,
  getOverview,
  updateGuardStatus
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/overview", asyncHandler(getOverview));
router.get("/guards", asyncHandler(getGuards));
router.get("/live-feed", asyncHandler(getLiveFeed));
router.post("/guards", asyncHandler(createGuard));
router.patch("/guards/:id/status", asyncHandler(updateGuardStatus));
router.delete("/guards/:id", asyncHandler(deleteGuard));

export default router;
