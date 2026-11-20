import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  createOrganization,
  findOrganizationByCode,
  findOrganizationById,
  listOrganizations,
  updateOrganization,
  upsertOrganizationSubscription
} from "../models/organizationModel.js";
import {
  countGuards,
  countOrganizationAdmins,
  createUser,
  findUserById,
  findUserByEmail,
  listUsers,
  updateOrganizationAdminProfile,
  updateUserPassword
} from "../models/userModel.js";
import {
  createHttpError,
  createId,
  normalizeEmail,
  now
} from "../services/coreService.js";
import { sanitizeUser } from "../services/auth.js";
import { deleteStoredSelfies, storeSelfieFile } from "../services/selfie.js";

function cleanText(value, fallback = "") {
  return String(value || fallback)
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeOrganizationCode(value, name) {
  const source = cleanText(value || name, "ORG");
  const code = source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return code || `ORG-${Math.floor(1000 + Math.random() * 9000)}`;
}

function normalizeSubscriptionPayload(payload = {}, organizationId, timestamp) {
  return {
    id: payload.id || createId(),
    organizationId,
    plan: cleanText(payload.plan, "starter").toLowerCase(),
    status: ["trial", "active", "past_due", "cancelled"].includes(payload.status)
      ? payload.status
      : "active",
    guardLimit: Math.max(1, Math.round(Number(payload.guardLimit) || 50)),
    startsAt: payload.startsAt || timestamp,
    renewsAt: payload.renewsAt || null,
    expiresAt: payload.expiresAt || null,
    notes: cleanText(payload.notes),
    updatedAt: timestamp
  };
}

function generateTemporaryPassword() {
  return `Temp-${crypto.randomBytes(6).toString("base64url")}!`;
}

function parseJsonField(value, fallback = {}) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getUploadedFile(request, fieldName) {
  const fileList = request.files?.[fieldName];
  return Array.isArray(fileList) ? fileList[0] || null : null;
}

async function enrichOrganization(organization) {
  const [guardCount, adminCount, users] = await Promise.all([
    countGuards(organization.id),
    countOrganizationAdmins(organization.id),
    listUsers(organization.id)
  ]);

  return {
    ...organization,
    metrics: {
      guardCount,
      adminCount
    },
    admins: users.filter((user) => user.role === "admin").map(sanitizeUser)
  };
}

export async function getPlatformOverview(_request, response) {
  const organizations = await Promise.all(
    (await listOrganizations()).map((organization) => enrichOrganization(organization))
  );

  return response.json({
    metrics: {
      organizations: organizations.length,
      activeOrganizations: organizations.filter((entry) => entry.status === "active").length,
      totalGuards: organizations.reduce(
        (total, entry) => total + (entry.metrics?.guardCount || 0),
        0
      ),
      activeSubscriptions: organizations.filter(
        (entry) => entry.subscription?.status === "active"
      ).length
    },
    organizations
  });
}

export async function createOrganizationWorkspace(request, response) {
  const {
    name,
    code,
    contactEmail,
    phone
  } = request.body ?? {};
  const subscription = parseJsonField(request.body?.subscription, {});
  const admin = parseJsonField(request.body?.admin, {});

  if (!name) {
    throw createHttpError(400, "Organization name is required.");
  }

  const normalizedCode = normalizeOrganizationCode(code, name);
  const existingOrganization = await findOrganizationByCode(normalizedCode);

  if (existingOrganization) {
    throw createHttpError(409, "An organization with that code already exists.");
  }

  const timestamp = now();
  const organizationLogoPath = await storeSelfieFile(getUploadedFile(request, "organizationLogo"));
  const organization = await createOrganization({
    id: createId(),
    name: cleanText(name),
    code: normalizedCode,
    contactEmail: cleanText(contactEmail),
    phone: cleanText(phone),
    logoUrl: organizationLogoPath,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await upsertOrganizationSubscription(
    normalizeSubscriptionPayload(subscription, organization.id, timestamp)
  );

  if (admin?.email || admin?.fullName || admin?.password) {
    await createOrganizationAdminForOrganization(organization.id, admin, {
      avatarFile: getUploadedFile(request, "adminPhoto")
    });
  }

  return response.status(201).json({
    organization: await enrichOrganization(
      (await listOrganizations()).find((entry) => entry.id === organization.id)
    )
  });
}

export async function updateOrganizationWorkspace(request, response) {
  const organization = await findOrganizationById(request.params.id);

  if (!organization) {
    throw createHttpError(404, "Organization not found.");
  }

  const {
    name,
    code,
    contactEmail,
    phone,
    status
  } = request.body ?? {};
  const subscription = parseJsonField(request.body?.subscription, {});
  const normalizedCode = normalizeOrganizationCode(code, name || organization.name);
  const existingOrganization = await findOrganizationByCode(normalizedCode);

  if (existingOrganization && existingOrganization.id !== organization.id) {
    throw createHttpError(409, "An organization with that code already exists.");
  }

  const timestamp = now();
  const organizationLogoPath = await storeSelfieFile(getUploadedFile(request, "organizationLogo"));
  const nextLogoUrl = organizationLogoPath || organization.logoUrl || null;

  await updateOrganization(organization.id, {
    name: cleanText(name, organization.name),
    code: normalizedCode,
    contactEmail: cleanText(contactEmail, organization.contactEmail),
    phone: cleanText(phone, organization.phone),
    logoUrl: nextLogoUrl,
    status: ["active", "suspended"].includes(status) ? status : organization.status,
    updatedAt: timestamp
  });

  if (organizationLogoPath && organization.logoUrl) {
    await deleteStoredSelfies([organization.logoUrl]);
  }

  await upsertOrganizationSubscription(
    normalizeSubscriptionPayload(
      {
        ...subscription,
        id: subscription.id
      },
      organization.id,
      timestamp
    )
  );

  return response.json({
    organization: await enrichOrganization(
      (await listOrganizations()).find((entry) => entry.id === organization.id)
    )
  });
}

async function createOrganizationAdminForOrganization(organizationId, admin = {}, options = {}) {
  const organization = await findOrganizationById(organizationId);

  if (!organization) {
    throw createHttpError(404, "Organization not found.");
  }

  const { fullName, email, password, phone } = admin;

  if (!fullName || !email || !password) {
    throw createHttpError(400, "Admin full name, email, and password are required.");
  }

  if (String(password).length < 8) {
    throw createHttpError(400, "Admin password must be at least 8 characters.");
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw createHttpError(409, "A user with that admin email already exists.");
  }

  const avatarUrl = await storeSelfieFile(options.avatarFile || null);

  return createUser({
    id: createId(),
    fullName: cleanText(fullName),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    role: "admin",
    organizationId,
    phone: cleanText(phone),
    employeeCode: `ADM-${Math.floor(100 + Math.random() * 900)}`,
    shiftLabel: "Organization Admin",
    status: "active",
    avatarUrl,
    sessionVersion: 1,
    lastLoginAt: null,
    lastSeenAt: null,
    createdAt: now()
  });
}

export async function createOrganizationAdmin(request, response) {
  const adminPayload = parseJsonField(request.body?.admin, request.body ?? {});
  const admin = await createOrganizationAdminForOrganization(request.params.id, adminPayload, {
    avatarFile: getUploadedFile(request, "adminPhoto")
  });
  const organization = (await listOrganizations()).find((entry) => entry.id === request.params.id);

  return response.status(201).json({
    admin: sanitizeUser(admin),
    organization: await enrichOrganization(organization)
  });
}

export async function updateOrganizationAdmin(request, response) {
  const organization = await findOrganizationById(request.params.id);

  if (!organization) {
    throw createHttpError(404, "Organization not found.");
  }

  const admin = await findUserById(request.params.adminId);

  if (
    !admin ||
    admin.role !== "admin" ||
    admin.organizationId !== organization.id
  ) {
    throw createHttpError(404, "Organization admin not found.");
  }

  const avatarFile = getUploadedFile(request, "adminPhoto");

  if (!avatarFile) {
    throw createHttpError(400, "Admin profile photo is required.");
  }

  const avatarUrl = await storeSelfieFile(avatarFile);
  const updatedAdmin = await updateOrganizationAdminProfile(
    admin.id,
    { avatarUrl },
    now()
  );

  if (admin.avatarUrl && admin.avatarUrl !== avatarUrl) {
    await deleteStoredSelfies([admin.avatarUrl]);
  }

  return response.json({
    admin: sanitizeUser(updatedAdmin),
    organization: await enrichOrganization(organization)
  });
}

export async function resetOrganizationAdminPassword(request, response) {
  const organization = await findOrganizationById(request.params.id);

  if (!organization) {
    throw createHttpError(404, "Organization not found.");
  }

  const admin = await findUserById(request.params.adminId);

  if (
    !admin ||
    admin.role !== "admin" ||
    admin.organizationId !== organization.id
  ) {
    throw createHttpError(404, "Organization admin not found.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const updatedAdmin = await updateUserPassword(
    admin.id,
    await bcrypt.hash(temporaryPassword, 10),
    now()
  );

  return response.json({
    admin: sanitizeUser(updatedAdmin),
    temporaryPassword
  });
}
