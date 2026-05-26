import { getDb } from "../database/connection.js";
import { getMongoCollection, isMongoEnabled, stripMongoId } from "../database/mongo.js";

const userSelect = `
  id,
  full_name AS fullName,
  email,
  password_hash AS passwordHash,
  role,
  organization_id AS organizationId,
  duty_site_id AS dutySiteId,
  phone,
  employee_code AS employeeCode,
  shift_label AS shiftLabel,
  status,
  avatar_url AS avatarUrl,
  identity_photo_path AS identityPhotoPath,
  identity_selfie_path AS identitySelfiePath,
  identity_enrolled_at AS identityEnrolledAt,
  session_version AS sessionVersion,
  last_login_at AS lastLoginAt,
  last_seen_at AS lastSeenAt,
  created_at AS createdAt
`;

export async function findUserById(id) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    return stripMongoId(await users.findOne({ id }));
  }

  const database = await getDb();
  return database.get(`SELECT ${userSelect} FROM users WHERE id = ?`, [id]);
}

export async function findUserByEmail(email) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    return stripMongoId(await users.findOne({ email }));
  }

  const database = await getDb();
  return database.get(`SELECT ${userSelect} FROM users WHERE email = ?`, [email]);
}

export async function createUser(user) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    await users.insertOne({ ...user });
    return findUserById(user.id);
  }

  const database = await getDb();
  await database.run(
    `INSERT INTO users (
      id, full_name, email, password_hash, role, organization_id, duty_site_id, phone, employee_code, shift_label,
      status, avatar_url, identity_photo_path, identity_selfie_path, identity_enrolled_at,
      session_version, last_login_at, last_seen_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.fullName,
      user.email,
      user.passwordHash,
      user.role,
      user.organizationId ?? null,
      user.dutySiteId ?? null,
      user.phone,
      user.employeeCode,
      user.shiftLabel,
      user.status,
      user.avatarUrl,
      user.identityPhotoPath ?? null,
      user.identitySelfiePath ?? null,
      user.identityEnrolledAt ?? null,
      user.sessionVersion,
      user.lastLoginAt,
      user.lastSeenAt,
      user.createdAt
    ]
  );

  return findUserById(user.id);
}

export async function updateUserLogin(id, timestamp) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    await users.updateOne({ id }, { $set: { lastLoginAt: timestamp, lastSeenAt: timestamp } });
    return;
  }

  const database = await getDb();
  await database.run(
    "UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?",
    [timestamp, timestamp, id]
  );
}

export async function touchUser(id, timestamp) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    await users.updateOne({ id }, { $set: { lastSeenAt: timestamp } });
    return;
  }

  const database = await getDb();
  await database.run("UPDATE users SET last_seen_at = ? WHERE id = ?", [timestamp, id]);
}

export async function incrementSessionVersion(id, timestamp = null) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    await users.updateOne(
      { id },
      {
        $inc: { sessionVersion: 1 },
        ...(timestamp ? { $set: { lastSeenAt: timestamp } } : {})
      }
    );
    return;
  }

  const database = await getDb();

  if (timestamp) {
    await database.run(
      "UPDATE users SET session_version = session_version + 1, last_seen_at = ? WHERE id = ?",
      [timestamp, id]
    );
    return;
  }

  await database.run(
    "UPDATE users SET session_version = session_version + 1 WHERE id = ?",
    [id]
  );
}

export async function updateUserPassword(id, passwordHash, timestamp) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    await users.updateOne(
      { id },
      {
        $set: { passwordHash, lastSeenAt: timestamp },
        $inc: { sessionVersion: 1 }
      }
    );
    return findUserById(id);
  }

  const database = await getDb();
  await database.run(
    `UPDATE users
     SET password_hash = ?,
         session_version = session_version + 1,
         last_seen_at = ?
     WHERE id = ?`,
    [passwordHash, timestamp, id]
  );

  return findUserById(id);
}

export async function updateUserStatus(id, status, timestamp) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    await users.updateOne(
      { id },
      { $set: { status, lastSeenAt: timestamp }, $inc: { sessionVersion: 1 } }
    );
    return;
  }

  const database = await getDb();
  await database.run(
    `UPDATE users
     SET status = ?, session_version = session_version + 1, last_seen_at = ?
     WHERE id = ?`,
    [status, timestamp, id]
  );
}

export async function updateGuardDetails(id, guard, timestamp) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    const nextValues = {
      fullName: guard.fullName,
      email: guard.email,
      phone: guard.phone,
      employeeCode: guard.employeeCode,
      shiftLabel: guard.shiftLabel,
      dutySiteId: guard.dutySiteId ?? null,
      lastSeenAt: timestamp
    };

    if (guard.passwordHash) {
      nextValues.passwordHash = guard.passwordHash;
    }

    if (guard.identityPhotoPath) {
      nextValues.identityPhotoPath = guard.identityPhotoPath;
    }

    if (guard.identitySelfiePath) {
      nextValues.identitySelfiePath = guard.identitySelfiePath;
    }

    if (guard.identityEnrolledAt) {
      nextValues.identityEnrolledAt = guard.identityEnrolledAt;
    }

    await users.updateOne(
      { id, role: "guard" },
      {
        $set: nextValues,
        ...(guard.passwordHash ? { $inc: { sessionVersion: 1 } } : {})
      }
    );

    return findUserById(id);
  }

  const database = await getDb();
  const passwordVersionBump = guard.passwordHash ? 1 : 0;

  await database.run(
    `UPDATE users
     SET full_name = ?,
         email = ?,
         password_hash = COALESCE(?, password_hash),
         phone = ?,
         employee_code = ?,
         shift_label = ?,
         duty_site_id = ?,
         identity_photo_path = COALESCE(?, identity_photo_path),
         identity_selfie_path = COALESCE(?, identity_selfie_path),
         identity_enrolled_at = COALESCE(?, identity_enrolled_at),
         session_version = session_version + ?,
         last_seen_at = ?
     WHERE id = ? AND role = 'guard'`,
    [
      guard.fullName,
      guard.email,
      guard.passwordHash || null,
      guard.phone,
      guard.employeeCode,
      guard.shiftLabel,
      guard.dutySiteId || null,
      guard.identityPhotoPath || null,
      guard.identitySelfiePath || null,
      guard.identityEnrolledAt || null,
      passwordVersionBump,
      timestamp,
      id
    ]
  );

  return findUserById(id);
}

export async function deleteUserById(id) {
  if (isMongoEnabled()) {
    const [users, attendance, activities, locations, selfies] = await Promise.all([
      getMongoCollection("users"),
      getMongoCollection("attendance"),
      getMongoCollection("activities"),
      getMongoCollection("locations"),
      getMongoCollection("selfies")
    ]);

    await Promise.all([
      attendance.deleteMany({ userId: id }),
      activities.deleteMany({ userId: id }),
      locations.deleteMany({ userId: id }),
      selfies.deleteMany({ userId: id })
    ]);

    return users.deleteOne({ id });
  }

  const database = await getDb();
  return database.run("DELETE FROM users WHERE id = ?", [id]);
}

export async function listGuards(organizationId = null) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    const query = {
      role: "guard",
      ...(organizationId ? { organizationId } : {})
    };
    return users.find(query).sort({ fullName: 1 }).toArray().then((rows) => rows.map(stripMongoId));
  }

  const database = await getDb();

  if (organizationId) {
    return database.all(
      `SELECT ${userSelect}
       FROM users
       WHERE role = 'guard' AND organization_id = ?
       ORDER BY full_name ASC`,
      [organizationId]
    );
  }

  return database.all(
    `SELECT ${userSelect}
     FROM users
     WHERE role = 'guard'
     ORDER BY full_name ASC`
  );
}

export async function listUsers(organizationId = null) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    const query = organizationId ? { organizationId } : {};
    return users.find(query).sort({ fullName: 1 }).toArray().then((rows) => rows.map(stripMongoId));
  }

  const database = await getDb();

  if (organizationId) {
    return database.all(
      `SELECT ${userSelect}
       FROM users
       WHERE organization_id = ?
       ORDER BY full_name ASC`,
      [organizationId]
    );
  }

  return database.all(`SELECT ${userSelect} FROM users ORDER BY full_name ASC`);
}

export async function countGuards(organizationId = null) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    return users.countDocuments({
      role: "guard",
      ...(organizationId ? { organizationId } : {})
    });
  }

  const database = await getDb();

  if (organizationId) {
    const row = await database.get(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'guard' AND organization_id = ?",
      [organizationId]
    );
    return row?.count || 0;
  }

  const row = await database.get(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'guard'"
  );
  return row?.count || 0;
}

export async function countOrganizationAdmins(organizationId) {
  if (isMongoEnabled()) {
    const users = await getMongoCollection("users");
    return users.countDocuments({ role: "admin", organizationId });
  }

  const database = await getDb();
  const row = await database.get(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND organization_id = ?",
    [organizationId]
  );
  return row?.count || 0;
}
