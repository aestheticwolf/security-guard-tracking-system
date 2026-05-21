import { getDb } from "../database/connection.js";

const locationSelect = `
  id,
  user_id AS userId,
  latitude,
  longitude,
  accuracy,
  address,
  zone_detail AS zoneDetail,
  duty_label AS dutyLabel,
  battery,
  tracked_at AS trackedAt
`;

export async function createLocation(location) {
  const database = await getDb();
  await database.run(
    `INSERT INTO locations (
      id, user_id, latitude, longitude, accuracy, address, zone_detail, duty_label, battery, tracked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      location.id,
      location.userId,
      location.latitude,
      location.longitude,
      location.accuracy,
      location.address,
      location.zoneDetail ?? null,
      location.dutyLabel ?? null,
      location.battery,
      location.trackedAt
    ]
  );
}

export async function listLocationsByUserId(userId) {
  const database = await getDb();
  return database.all(
    `SELECT ${locationSelect}
     FROM locations
     WHERE user_id = ?
     ORDER BY tracked_at DESC, rowid DESC`,
    [userId]
  );
}

export async function findLatestLocationByUserId(userId) {
  const database = await getDb();
  return database.get(
    `SELECT ${locationSelect}
     FROM locations
     WHERE user_id = ?
     ORDER BY tracked_at DESC, rowid DESC
     LIMIT 1`,
    [userId]
  );
}

export async function listLocationsForDate(dateKey) {
  const database = await getDb();
  return database.all(
    `SELECT ${locationSelect}
     FROM locations
     WHERE substr(tracked_at, 1, 10) = ?
     ORDER BY tracked_at DESC, rowid DESC`,
    [dateKey]
  );
}

export async function listAllLocations() {
  const database = await getDb();
  return database.all(`SELECT ${locationSelect} FROM locations ORDER BY tracked_at DESC, rowid DESC`);
}
