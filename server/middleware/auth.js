import { findUserById } from "../models/userModel.js";
import { verifyJwtToken } from "../services/auth.js";

function getBearerToken(request) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.replace("Bearer ", "").trim();
}

export async function requireAuth(request, response, next) {
  const token = getBearerToken(request);

  if (!token) {
    return response.status(401).json({ message: "Authentication token missing." });
  }

  try {
    const payload = verifyJwtToken(token);
    const user = await findUserById(payload.sub);

    if (!user || user.sessionVersion !== payload.sessionVersion || user.status !== "active") {
      return response.status(401).json({ message: "Session expired or access revoked." });
    }

    request.user = user;
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid authentication token." });
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ message: "You do not have permission for this action." });
    }

    return next();
  };
}
