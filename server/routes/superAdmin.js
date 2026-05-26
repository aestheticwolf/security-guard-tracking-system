import { Router } from "express";
import {
  createOrganizationAdmin,
  createOrganizationWorkspace,
  getPlatformOverview,
  resetOrganizationAdminPassword,
  updateOrganizationWorkspace
} from "../controllers/superAdminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.use(requireAuth, requireRole("super_admin"));

router.get("/overview", asyncHandler(getPlatformOverview));
router.post("/organizations", asyncHandler(createOrganizationWorkspace));
router.patch("/organizations/:id", asyncHandler(updateOrganizationWorkspace));
router.post("/organizations/:id/admins", asyncHandler(createOrganizationAdmin));
router.patch(
  "/organizations/:id/admins/:adminId/password",
  asyncHandler(resetOrganizationAdminPassword)
);

export default router;
