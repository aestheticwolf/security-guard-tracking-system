import { getDb } from "../database/connection.js";
import { getMongoCollection, isMongoEnabled, stripMongoId } from "../database/mongo.js";

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("locations");
    await collection.insertOne({ ...location });
    return;
  }

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("locations");
    const rows = await collection.find({ userId }).sort({ trackedAt: -1 }).toArray();
    return rows.map(stripMongoId);
  }

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("locations");
    return stripMongoId(await collection.findOne({ userId }, { sort: { trackedAt: -1 } }));
  }

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("locations");
    const rows = await collection
      .find({ trackedAt: { $regex: `^${dateKey}` } })
      .sort({ trackedAt: -1 })
      .toArray();
    return rows.map(stripMongoId);
  }

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
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("locations");
    const rows = await collection.find({}).sort({ trackedAt: -1 }).toArray();
    return rows.map(stripMongoId);
  }

  const database = await getDb();
  return database.all(`SELECT ${locationSelect} FROM locations ORDER BY tracked_at DESC, rowid DESC`);
}
