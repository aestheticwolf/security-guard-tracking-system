import { Router } from "express";
import {
  checkIn,
  checkOut,
  createGuardActivity,
  getActivities,
  getLatestLocation,
  getOverview,
  syncLocation
} from "../controllers/guardController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { selfieUpload } from "../services/selfie.js";

const router = Router();

router.use(requireAuth, requireRole("guard"));

router.get("/overview", asyncHandler(getOverview));
router.get("/activities", asyncHandler(getActivities));
router.post("/attendance/check-in", selfieUpload.single("selfie"), asyncHandler(checkIn));
router.post("/attendance/check-out", selfieUpload.single("selfie"), asyncHandler(checkOut));
router.post("/activity", asyncHandler(createGuardActivity));
router.post("/location", asyncHandler(syncLocation));
router.get("/location/latest", asyncHandler(getLatestLocation));

export default router;
