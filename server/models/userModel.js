import { getDb } from "../database/connection.js";

const userSelect = `
  id,
  full_name AS fullName,
  email,
  password_hash AS passwordHash,
  role,
  phone,
  employee_code AS employeeCode,
  shift_label AS shiftLabel,
  status,
  avatar_url AS avatarUrl,
  session_version AS sessionVersion,
  last_login_at AS lastLoginAt,
  last_seen_at AS lastSeenAt,
  created_at AS createdAt
`;

export async function findUserById(id) {
  const database = await getDb();
  return database.get(`SELECT ${userSelect} FROM users WHERE id = ?`, [id]);
}

export async function findUserByEmail(email) {
  const database = await getDb();
  return database.get(`SELECT ${userSelect} FROM users WHERE email = ?`, [email]);
}

export async function createUser(user) {
  const database = await getDb();
  await database.run(
    `INSERT INTO users (
      id, full_name, email, password_hash, role, phone, employee_code, shift_label,
      status, avatar_url, session_version, last_login_at, last_seen_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.fullName,
      user.email,
      user.passwordHash,
      user.role,
      user.phone,
      user.employeeCode,
      user.shiftLabel,
      user.status,
      user.avatarUrl,
      user.sessionVersion,
      user.lastLoginAt,
      user.lastSeenAt,
      user.createdAt
    ]
  );

  return findUserById(user.id);
}

export async function updateUserLogin(id, timestamp) {
  const database = await getDb();
  await database.run(
    "UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?",
    [timestamp, timestamp, id]
  );
}

export async function touchUser(id, timestamp) {
  const database = await getDb();
  await database.run("UPDATE users SET last_seen_at = ? WHERE id = ?", [timestamp, id]);
}

export async function incrementSessionVersion(id, timestamp = null) {
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

export async function updateUserStatus(id, status, timestamp) {
  const database = await getDb();
  await database.run(
    `UPDATE users
     SET status = ?, session_version = session_version + 1, last_seen_at = ?
     WHERE id = ?`,
    [status, timestamp, id]
  );
}

export async function updateGuardDetails(id, guard, timestamp) {
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
      passwordVersionBump,
      timestamp,
      id
    ]
  );

  return findUserById(id);
}

export async function deleteUserById(id) {
  const database = await getDb();
  return database.run("DELETE FROM users WHERE id = ?", [id]);
}

export async function listGuards() {
  const database = await getDb();
  return database.all(
    `SELECT ${userSelect}
     FROM users
     WHERE role = 'guard'
     ORDER BY full_name ASC`
  );
}

export async function listUsers() {
  const database = await getDb();
  return database.all(`SELECT ${userSelect} FROM users ORDER BY full_name ASC`);
}

export async function countGuards() {
  const database = await getDb();
  const row = await database.get(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'guard'"
  );
  return row?.count || 0;
}
