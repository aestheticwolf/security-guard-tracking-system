import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET || "local-dev-secret-change-this";

export function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      sessionVersion: user.sessionVersion
    },
    jwtSecret,
    { expiresIn: "12h" }
  );
}

export function verifyJwtToken(token) {
  return jwt.verify(token, jwtSecret);
}

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId ?? null,
    dutySiteId: user.dutySiteId ?? null,
    phone: user.phone,
    employeeCode: user.employeeCode,
    shiftLabel: user.shiftLabel,
    status: user.status,
    avatarUrl: user.avatarUrl,
    lastLoginAt: user.lastLoginAt,
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt
  };
}
