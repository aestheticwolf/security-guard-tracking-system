import bcrypt from "bcryptjs";
import { createActivity } from "../models/activityModel.js";
import { listSelfiesByUserId } from "../models/selfieModel.js";
import {
  findUserById,
  findUserByEmail,
  createUser,
  updateUserStatus,
  updateGuardDetails,
  deleteUserById
} from "../models/userModel.js";
import { buildAdminOverview, buildGuardRoster, buildLiveFeed } from "../services/adminDashboardService.js";
import {
  createHttpError,
  createId,
  normalizeEmail,
  now
} from "../services/coreService.js";
import { sanitizeUser } from "../services/auth.js";
import { deleteStoredSelfies } from "../services/selfie.js";

export async function getOverview(_request, response) {
  return response.json(await buildAdminOverview());
}

export async function getGuards(_request, response) {
  return response.json({ guards: await buildGuardRoster() });
}

export async function getLiveFeed(_request, response) {
  return response.json({ events: await buildLiveFeed(30) });
}

export async function createGuard(request, response) {
  const { fullName, email, password, phone, shiftLabel, employeeCode } = request.body ?? {};

  if (!fullName || !email || !password) {
    throw createHttpError(400, "Full name, email, and password are required.");
  }

  if (String(password).length < 8) {
    throw createHttpError(400, "Password must be at least 8 characters.");
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw createHttpError(409, "A guard with that email already exists.");
  }

  const createdAt = now();
  const guard = await createUser({
    id: createId(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    role: "guard",
    phone: phone ? String(phone).trim() : "",
    employeeCode: employeeCode ? String(employeeCode).trim() : `GRD-${Math.floor(100 + Math.random() * 900)}`,
    shiftLabel: shiftLabel ? String(shiftLabel).trim() : "Patrol Route",
    status: "active",
    avatarUrl: null,
    sessionVersion: 1,
    lastLoginAt: null,
    lastSeenAt: null,
    createdAt
  });

  await createActivity({
    id: createId(),
    userId: guard.id,
    type: "assignment",
    title: "Guard added to roster",
    description: "Admin created a new guard profile and shift assignment.",
    priority: "low",
    status: "logged",
    createdAt,
    updatedAt: createdAt
  });

  return response.status(201).json({ guard: sanitizeUser(guard) });
}

export async function updateGuardStatus(request, response) {
  const { status } = request.body ?? {};

  if (!["active", "inactive"].includes(status)) {
    throw createHttpError(400, "Status must be active or inactive.");
  }

  const user = await findUserById(request.params.id);

  if (!user || user.role !== "guard") {
    throw createHttpError(404, "Guard not found.");
  }

  await updateUserStatus(request.params.id, status, now());

  return response.json({ guards: await buildGuardRoster() });
}

export async function updateGuard(request, response) {
  const { fullName, email, password, phone, shiftLabel, employeeCode } = request.body ?? {};

  if (!fullName || !email) {
    throw createHttpError(400, "Full name and email are required.");
  }

  const nextPassword = password ? String(password) : "";

  if (nextPassword && nextPassword.length < 8) {
    throw createHttpError(400, "Password must be at least 8 characters.");
  }

  const user = await findUserById(request.params.id);

  if (!user || user.role !== "guard") {
    throw createHttpError(404, "Guard not found.");
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser && existingUser.id !== user.id) {
    throw createHttpError(409, "A guard with that email already exists.");
  }

  const updatedAt = now();
  const updatedGuard = await updateGuardDetails(
    request.params.id,
    {
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      passwordHash: nextPassword ? await bcrypt.hash(nextPassword, 10) : null,
      phone: phone ? String(phone).trim() : "",
      employeeCode: employeeCode ? String(employeeCode).trim() : user.employeeCode,
      shiftLabel: shiftLabel ? String(shiftLabel).trim() : "Patrol Route"
    },
    updatedAt
  );

  await createActivity({
    id: createId(),
    userId: updatedGuard.id,
    type: "assignment",
    title: "Guard profile updated",
    description: nextPassword
      ? "Admin updated guard details and reset the login password."
      : "Admin updated guard profile details.",
    priority: "low",
    status: "logged",
    createdAt: updatedAt,
    updatedAt
  });

  return response.json({ guards: await buildGuardRoster() });
}

export async function deleteGuard(request, response) {
  const user = await findUserById(request.params.id);

  if (!user || user.role !== "guard") {
    throw createHttpError(404, "Guard not found.");
  }

  const selfies = await listSelfiesByUserId(user.id);
  await deleteStoredSelfies(selfies.map((entry) => entry.imagePath));
  await deleteUserById(user.id);

  return response.json({ guards: await buildGuardRoster() });
}
