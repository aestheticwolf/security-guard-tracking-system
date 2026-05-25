import { getDb } from "../database/connection.js";
import { getMongoCollection, isMongoEnabled, stripMongoId } from "../database/mongo.js";

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("attendance");
    await collection.insertOne({ ...attendance });
    return;
  }

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("attendance");
    return stripMongoId(
      await collection.findOne(
        { userId, status: "checked-in", checkOutAt: null },
        { sort: { checkInAt: -1 } }
      )
    );
  }

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("attendance");
    await collection.updateOne(
      { id },
      { $set: { checkOutAt: payload.checkOutAt, status: payload.status, note: payload.note } }
    );
    return;
  }

  const database = await getDb();
  await database.run(
    `UPDATE attendance
     SET check_out_at = ?, status = ?, note = ?
     WHERE id = ?`,
    [payload.checkOutAt, payload.status, payload.note, id]
  );
}

export async function listAttendanceByUserId(userId) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("attendance");
    const rows = await collection.find({ userId }).sort({ checkInAt: -1 }).toArray();
    return rows.map(stripMongoId);
  }

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("attendance");
    const rows = await collection
      .find({ checkInAt: { $regex: `^${dateKey}` } })
      .sort({ checkInAt: -1 })
      .toArray();
    return rows.map(stripMongoId);
  }

  const database = await getDb();
  return database.all(
    `SELECT ${attendanceSelect}
     FROM attendance
     WHERE substr(check_in_at, 1, 10) = ?
     ORDER BY check_in_at DESC, rowid DESC`,
    [dateKey]
  );
}
