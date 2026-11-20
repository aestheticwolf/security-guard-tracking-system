import bcrypt from "bcryptjs";
import {
  findUserByEmail,
  incrementSessionVersion,
  updateUserLogin
} from "../models/userModel.js";
import { issueToken, sanitizeUser } from "../services/auth.js";
import {
  createHttpError,
  normalizeEmail,
  now
} from "../services/coreService.js";

export async function login(request, response) {
  const { email, password } = request.body ?? {};

  if (!email || !password) {
    throw createHttpError(400, "Email and password are required.");
  }

  const user = await findUserByEmail(normalizeEmail(email));

  if (!user) {
    throw createHttpError(401, "Invalid email or password.");
  }

  if (user.status !== "active") {
    throw createHttpError(403, "This account is currently inactive.");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw createHttpError(401, "Invalid email or password.");
  }

  const timestamp = now();
  await updateUserLogin(user.id, timestamp);

  const nextUser = {
    ...user,
    lastLoginAt: timestamp,
    lastSeenAt: timestamp
  };

  return response.json({
    token: issueToken(nextUser),
    user: sanitizeUser(nextUser)
  });
}

export async function getProfile(request, response) {
  return response.json({ user: sanitizeUser(request.user) });
}

export async function logout(request, response) {
  await incrementSessionVersion(request.user.id, now());
  return response.json({ success: true });
}
