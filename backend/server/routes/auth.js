import { Router } from "express";
import {
  getProfile,
  login,
  logout
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(getProfile));
router.post("/logout", requireAuth, asyncHandler(logout));

export default router;
