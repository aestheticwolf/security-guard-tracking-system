import { getDb } from "../database/connection.js";
import { getMongoCollection, isMongoEnabled, stripMongoId } from "../database/mongo.js";

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
    captureSource: row.captureSource || "unknown",
    identityStatus: row.identityStatus || "no_reference",
    identityScore: row.identityScore ?? 0,
    identityNotes: row.identityNotes || "",
    capturedAt: row.capturedAt
  };
}

export async function createSelfie(selfie) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("selfies");
    await collection.insertOne({ ...selfie });
    return;
  }

  const database = await getDb();
  await database.run(
    `INSERT INTO selfies (
      id, user_id, attendance_id, image_path, verified, verification_score,
      capture_source, identity_status, identity_score, identity_notes, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      selfie.id,
      selfie.userId,
      selfie.attendanceId,
      selfie.imagePath,
      selfie.verified ? 1 : 0,
      selfie.verificationScore,
      selfie.captureSource || "unknown",
      selfie.identityStatus || "no_reference",
      selfie.identityScore ?? 0,
      selfie.identityNotes || "",
      selfie.capturedAt
    ]
  );
}

export async function updateSelfieVerification(id, verification) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("selfies");
    await collection.updateOne(
      { id },
      {
        $set: {
          verified: Boolean(verification.verified),
          verificationScore: verification.verificationScore,
          identityStatus: verification.identityStatus || "reference_review",
          identityScore: verification.identityScore ?? 0,
          identityNotes: verification.identityNotes || ""
        }
      }
    );
    return;
  }

  const database = await getDb();
  await database.run(
    `UPDATE selfies
     SET verified = ?,
         verification_score = ?,
         identity_status = ?,
         identity_score = ?,
         identity_notes = ?
     WHERE id = ?`,
    [
      verification.verified ? 1 : 0,
      verification.verificationScore,
      verification.identityStatus || "reference_review",
      verification.identityScore ?? 0,
      verification.identityNotes || "",
      id
    ]
  );
}

export async function listSelfiesByUserId(userId) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("selfies");
    const rows = await collection.find({ userId }).sort({ capturedAt: -1 }).toArray();
    return rows.map((row) => mapSelfie(stripMongoId(row)));
  }

  const database = await getDb();
  const rows = await database.all(
    `SELECT
      id,
      user_id AS userId,
      attendance_id AS attendanceId,
      image_path AS imagePath,
      verified,
      verification_score AS verificationScore,
      capture_source AS captureSource,
      identity_status AS identityStatus,
      identity_score AS identityScore,
      identity_notes AS identityNotes,
      captured_at AS capturedAt
     FROM selfies
     WHERE user_id = ?
     ORDER BY captured_at DESC, rowid DESC`,
    [userId]
  );

  return rows.map(mapSelfie);
}
