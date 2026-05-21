import { getDb } from "../database/connection.js";

function mapSelfie(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    attendanceId: row.attendanceId,
    imagePath: row.imagePath,
    verified: Boolean(row.verified),
    verificationScore: row.verificationScore,
    capturedAt: row.capturedAt
  };
}

export async function createSelfie(selfie) {
  const database = await getDb();
  await database.run(
    `INSERT INTO selfies (
      id, user_id, attendance_id, image_path, verified, verification_score, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      selfie.id,
      selfie.userId,
      selfie.attendanceId,
      selfie.imagePath,
      selfie.verified ? 1 : 0,
      selfie.verificationScore,
      selfie.capturedAt
    ]
  );
}

export async function listSelfiesByUserId(userId) {
  const database = await getDb();
  const rows = await database.all(
    `SELECT
      id,
      user_id AS userId,
      attendance_id AS attendanceId,
      image_path AS imagePath,
      verified,
      verification_score AS verificationScore,
      captured_at AS capturedAt
     FROM selfies
     WHERE user_id = ?
     ORDER BY captured_at DESC`,
    [userId]
  );

  return rows.map(mapSelfie);
}
