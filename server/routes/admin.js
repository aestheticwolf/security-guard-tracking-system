import { Router } from "express";
import {
  createGuard,
  createDutySite,
  deleteGuard,
  getDutySites,
  getGuards,
  getLiveFeed,
  getOverview,
  updateGuard,
  updateGuardStatus,
  updateDutySite
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { selfieUpload } from "../services/selfie.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/overview", asyncHandler(getOverview));
router.get("/duty-sites", asyncHandler(getDutySites));
router.post("/duty-sites", asyncHandler(createDutySite));
router.patch("/duty-sites/:id", asyncHandler(updateDutySite));
router.get("/guards", asyncHandler(getGuards));
router.get("/live-feed", asyncHandler(getLiveFeed));
router.post(
  "/guards",
  selfieUpload.fields([
    { name: "identityPhoto", maxCount: 1 },
    { name: "identitySelfie", maxCount: 1 }
  ]),
  asyncHandler(createGuard)
);
router.patch(
  "/guards/:id",
  selfieUpload.fields([
    { name: "identityPhoto", maxCount: 1 },
    { name: "identitySelfie", maxCount: 1 }
  ]),
  asyncHandler(updateGuard)
);
router.patch("/guards/:id/status", asyncHandler(updateGuardStatus));
router.delete("/guards/:id", asyncHandler(deleteGuard));

export default router;
