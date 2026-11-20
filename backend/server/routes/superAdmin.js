import { Router } from "express";
import {
  createOrganizationAdmin,
  createOrganizationWorkspace,
  getPlatformOverview,
  resetOrganizationAdminPassword,
  updateOrganizationAdmin,
  updateOrganizationWorkspace
} from "../controllers/superAdminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { selfieUpload } from "../services/selfie.js";

const router = Router();

router.use(requireAuth, requireRole("super_admin"));

router.get("/overview", asyncHandler(getPlatformOverview));
router.post(
  "/organizations",
  selfieUpload.fields([
    { name: "adminPhoto", maxCount: 1 },
    { name: "organizationLogo", maxCount: 1 }
  ]),
  asyncHandler(createOrganizationWorkspace)
);
router.patch(
  "/organizations/:id",
  selfieUpload.fields([{ name: "organizationLogo", maxCount: 1 }]),
  asyncHandler(updateOrganizationWorkspace)
);
router.post(
  "/organizations/:id/admins",
  selfieUpload.fields([{ name: "adminPhoto", maxCount: 1 }]),
  asyncHandler(createOrganizationAdmin)
);
router.patch(
  "/organizations/:id/admins/:adminId",
  selfieUpload.fields([{ name: "adminPhoto", maxCount: 1 }]),
  asyncHandler(updateOrganizationAdmin)
);
router.patch(
  "/organizations/:id/admins/:adminId/password",
  asyncHandler(resetOrganizationAdminPassword)
);

export default router;
