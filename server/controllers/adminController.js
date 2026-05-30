import bcrypt from "bcryptjs";
import { createActivity } from "../models/activityModel.js";
import { listSelfiesByUserId } from "../models/selfieModel.js";
import {
  findUserById,
  findUserByEmail,
  createUser,
  updateUserStatus,
  updateGuardDetails,
  deleteUserById,
  countGuards
} from "../models/userModel.js";
import {
  findOrganizationSubscription,
  updateOrganizationDutyLabels
} from "../models/organizationModel.js";
import {
  createDutySite as createDutySiteRecord,
  findDutySiteById,
  listDutySites,
  updateDutySite as updateDutySiteRecord
} from "../models/dutySiteModel.js";
import { buildAdminOverview, buildGuardRoster, buildLiveFeed } from "../services/adminDashboardService.js";
import {
  createHttpError,
  createId,
  normalizeEmail,
  now
} from "../services/coreService.js";
import { sanitizeUser } from "../services/auth.js";
import { deleteStoredSelfies, storeSelfieFile } from "../services/selfie.js";

function requireOrganizationAdmin(request) {
  if (!request.user.organizationId) {
    throw createHttpError(403, "This admin account is not assigned to an organization.");
  }

  return request.user.organizationId;
}

function assertSameOrganization(user, organizationId) {
  if (!user || user.organizationId !== organizationId) {
    throw createHttpError(404, "Guard not found.");
  }
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback)
    .trim()
    .replace(/\s+/g, " ");
}

function parseCoordinate(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw createHttpError(400, `${label} must be a valid number.`);
  }

  return numericValue;
}

function assertCoordinateRange(latitude, longitude) {
  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    throw createHttpError(400, "Latitude must be between -90 and 90.");
  }

  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    throw createHttpError(400, "Longitude must be between -180 and 180.");
  }
}

async function resolveDutySiteId(dutySiteId, organizationId) {
  const normalizedDutySiteId = cleanText(dutySiteId);

  if (!normalizedDutySiteId) {
    return null;
  }

  const dutySite = await findDutySiteById(normalizedDutySiteId, organizationId);

  if (!dutySite || dutySite.status !== "active") {
    throw createHttpError(400, "Selected duty site is not available for this organization.");
  }

  return dutySite.id;
}

function getUploadedFile(request, fieldName) {
  const fileList = request.files?.[fieldName];
  return Array.isArray(fileList) ? fileList[0] || null : null;
}

async function storeIdentityEnrollmentImages(request) {
  const identityPhotoFile = getUploadedFile(request, "identityPhoto");
  const identitySelfieFile = getUploadedFile(request, "identitySelfie");
  const [identityPhotoPath, identitySelfiePath] = await Promise.all([
    storeSelfieFile(identityPhotoFile),
    storeSelfieFile(identitySelfieFile)
  ]);

  return {
    identityPhotoPath,
    identitySelfiePath,
    hasIdentityEnrollment: Boolean(identityPhotoPath || identitySelfiePath)
  };
}

export async function getOverview(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  return response.json(await buildAdminOverview(organizationId));
}

export async function getDutySites(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  return response.json({ dutySites: await listDutySites(organizationId) });
}

export async function createDutySite(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  const { name, area, address, latitude, longitude } = request.body ?? {};
  const siteName = cleanText(name);

  if (!siteName) {
    throw createHttpError(400, "Duty site name is required.");
  }

  const parsedLatitude = parseCoordinate(latitude, "Latitude");
  const parsedLongitude = parseCoordinate(longitude, "Longitude");
  assertCoordinateRange(parsedLatitude, parsedLongitude);

  const timestamp = now();
  const dutySite = await createDutySiteRecord({
    id: createId(),
    organizationId,
    name: siteName,
    area: cleanText(area),
    address: cleanText(address),
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return response.status(201).json({
    dutySite,
    overview: await buildAdminOverview(organizationId)
  });
}

export async function updateDutySite(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  const existingDutySite = await findDutySiteById(request.params.id, organizationId);

  if (!existingDutySite) {
    throw createHttpError(404, "Duty site not found.");
  }

  const { name, area, address, latitude, longitude, status } = request.body ?? {};
  const siteName = cleanText(name, existingDutySite.name);

  if (!siteName) {
    throw createHttpError(400, "Duty site name is required.");
  }

  const parsedLatitude =
    latitude === undefined ? existingDutySite.latitude : parseCoordinate(latitude, "Latitude");
  const parsedLongitude =
    longitude === undefined ? existingDutySite.longitude : parseCoordinate(longitude, "Longitude");
  assertCoordinateRange(parsedLatitude, parsedLongitude);

  const dutySite = await updateDutySiteRecord(request.params.id, organizationId, {
    name: siteName,
    area: cleanText(area, existingDutySite.area),
    address: cleanText(address, existingDutySite.address),
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    status: ["active", "inactive"].includes(status) ? status : existingDutySite.status,
    updatedAt: now()
  });

  return response.json({
    dutySite,
    overview: await buildAdminOverview(organizationId)
  });
}

export async function updateDutyLabels(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  const rawLabels = Array.isArray(request.body?.labels) ? request.body.labels : [];
  const labels = rawLabels.map((label) => cleanText(label)).filter(Boolean);

  if (!labels.length) {
    throw createHttpError(400, "At least one duty zone label is required.");
  }

  const organization = await updateOrganizationDutyLabels(organizationId, labels);

  return response.json({
    organization,
    overview: await buildAdminOverview(organizationId)
  });
}

export async function getGuards(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  return response.json({ guards: await buildGuardRoster(organizationId) });
}

export async function getLiveFeed(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  return response.json({ events: await buildLiveFeed(30, organizationId) });
}

export async function createGuard(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  const { fullName, email, password, phone, shiftLabel, employeeCode, dutySiteId } = request.body ?? {};

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

  const subscription = await findOrganizationSubscription(organizationId);
  const guardLimit = Number(subscription?.guardLimit || 0);

  if (guardLimit > 0 && (await countGuards(organizationId)) >= guardLimit) {
    throw createHttpError(403, "This organization's guard limit has been reached.");
  }

  const createdAt = now();
  const assignedDutySiteId = await resolveDutySiteId(dutySiteId, organizationId);
  const identityEnrollment = await storeIdentityEnrollmentImages(request);
  const guard = await createUser({
    id: createId(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    role: "guard",
    organizationId,
    dutySiteId: assignedDutySiteId,
    phone: phone ? String(phone).trim() : "",
    employeeCode: employeeCode ? String(employeeCode).trim() : `GRD-${Math.floor(100 + Math.random() * 900)}`,
    shiftLabel: shiftLabel ? String(shiftLabel).trim() : "Patrol Route",
    status: "active",
    avatarUrl: identityEnrollment.identityPhotoPath || identityEnrollment.identitySelfiePath || null,
    identityPhotoPath: identityEnrollment.identityPhotoPath,
    identitySelfiePath: identityEnrollment.identitySelfiePath,
    identityEnrolledAt: identityEnrollment.hasIdentityEnrollment ? createdAt : null,
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
    description: identityEnrollment.hasIdentityEnrollment
      ? "Admin created a new guard profile, shift assignment, and identity reference images."
      : "Admin created a new guard profile and shift assignment.",
    priority: "low",
    status: "logged",
    createdAt,
    updatedAt: createdAt
  });

  return response.status(201).json({ guard: sanitizeUser(guard) });
}

export async function updateGuardStatus(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  const { status } = request.body ?? {};

  if (!["active", "inactive"].includes(status)) {
    throw createHttpError(400, "Status must be active or inactive.");
  }

  const user = await findUserById(request.params.id);

  if (!user || user.role !== "guard") {
    throw createHttpError(404, "Guard not found.");
  }

  assertSameOrganization(user, organizationId);

  await updateUserStatus(request.params.id, status, now());

  return response.json({ guards: await buildGuardRoster(organizationId) });
}

export async function updateGuard(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  const body = request.body ?? {};
  const { fullName, email, password, phone, shiftLabel, employeeCode, dutySiteId } = body;

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

  assertSameOrganization(user, organizationId);

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser && existingUser.id !== user.id) {
    throw createHttpError(409, "A guard with that email already exists.");
  }

  const updatedAt = now();
  const hasDutySiteAssignment = Object.prototype.hasOwnProperty.call(body, "dutySiteId");
  const assignedDutySiteId = hasDutySiteAssignment
    ? await resolveDutySiteId(dutySiteId, organizationId)
    : user.dutySiteId ?? null;
  const identityEnrollment = await storeIdentityEnrollmentImages(request);
  const nextAvatarUrl =
    identityEnrollment.identityPhotoPath ||
    user.identityPhotoPath ||
    identityEnrollment.identitySelfiePath ||
    user.identitySelfiePath ||
    user.avatarUrl ||
    null;
  const updatedGuard = await updateGuardDetails(
    request.params.id,
    {
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      passwordHash: nextPassword ? await bcrypt.hash(nextPassword, 10) : null,
      phone: phone ? String(phone).trim() : "",
      employeeCode: employeeCode ? String(employeeCode).trim() : user.employeeCode,
      shiftLabel: shiftLabel ? String(shiftLabel).trim() : "Patrol Route",
      dutySiteId: assignedDutySiteId,
      avatarUrl: nextAvatarUrl,
      identityPhotoPath: identityEnrollment.identityPhotoPath,
      identitySelfiePath: identityEnrollment.identitySelfiePath,
      identityEnrolledAt: identityEnrollment.hasIdentityEnrollment ? updatedAt : null
    },
    updatedAt
  );

  if (identityEnrollment.identityPhotoPath && user.identityPhotoPath) {
    await deleteStoredSelfies([user.identityPhotoPath]);
  }

  if (identityEnrollment.identitySelfiePath && user.identitySelfiePath) {
    await deleteStoredSelfies([user.identitySelfiePath]);
  }

  await createActivity({
    id: createId(),
    userId: updatedGuard.id,
    type: "assignment",
    title: "Guard profile updated",
    description: identityEnrollment.hasIdentityEnrollment
      ? "Admin updated guard details and refreshed identity reference images."
      : nextPassword
        ? "Admin updated guard details and reset the login password."
        : "Admin updated guard profile details.",
    priority: "low",
    status: "logged",
    createdAt: updatedAt,
    updatedAt
  });

  return response.json({ guards: await buildGuardRoster(organizationId) });
}

export async function deleteGuard(request, response) {
  const organizationId = requireOrganizationAdmin(request);
  const user = await findUserById(request.params.id);

  if (!user || user.role !== "guard") {
    throw createHttpError(404, "Guard not found.");
  }

  assertSameOrganization(user, organizationId);

  const selfies = await listSelfiesByUserId(user.id);
  await deleteStoredSelfies([
    ...selfies.map((entry) => entry.imagePath),
    user.identityPhotoPath,
    user.identitySelfiePath
  ]);
  await deleteUserById(user.id);

  return response.json({ guards: await buildGuardRoster(organizationId) });
}
