import { getDb } from "../database/connection.js";

const attendanceSelect = `
  id,
  user_id AS userId,
  check_in_at AS checkInAt,
  check_out_at AS checkOutAt,
  status,
  selfie_path AS selfiePath,
  location_label AS locationLabel,
  latitude,
  longitude,
  accuracy,
  note
`;

export async function createAttendance(attendance) {
  const database = await getDb();
  await database.run(
    `INSERT INTO attendance (
      id, user_id, check_in_at, check_out_at, status, selfie_path, location_label,
      latitude, longitude, accuracy, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attendance.id,
      attendance.userId,
      attendance.checkInAt,
      attendance.checkOutAt,
      attendance.status,
      attendance.selfiePath,
      attendance.locationLabel,
      attendance.latitude,
      attendance.longitude,
      attendance.accuracy,
      attendance.note
    ]
  );
}

export async function findOpenAttendanceByUserId(userId) {
  const database = await getDb();
  return database.get(
    `SELECT ${attendanceSelect}
     FROM attendance
     WHERE user_id = ? AND status = 'checked-in' AND check_out_at IS NULL
     ORDER BY check_in_at DESC, rowid DESC
     LIMIT 1`,
    [userId]
  );
}

export async function updateAttendanceOnCheckout(id, payload) {
  const database = await getDb();
  await database.run(
    `UPDATE attendance
     SET check_out_at = ?, status = ?, note = ?
     WHERE id = ?`,
    [payload.checkOutAt, payload.status, payload.note, id]
  );
}

export async function listAttendanceByUserId(userId) {
  const database = await getDb();
  return database.all(
    `SELECT ${attendanceSelect}
     FROM attendance
     WHERE user_id = ?
     ORDER BY check_in_at DESC, rowid DESC`,
    [userId]
  );
}

export async function listAttendanceForDate(dateKey) {
  const database = await getDb();
  return database.all(
    `SELECT ${attendanceSelect}
     FROM attendance
     WHERE substr(check_in_at, 1, 10) = ?
     ORDER BY check_in_at DESC, rowid DESC`,
    [dateKey]
  );
}
