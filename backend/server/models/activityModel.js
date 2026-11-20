import { getDb } from "../database/connection.js";
import { getMongoCollection, isMongoEnabled, stripMongoId } from "../database/mongo.js";

const activitySelect = `
  id,
  user_id AS userId,
  type,
  title,
  description,
  priority,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

export async function createActivity(activity) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("activities");
    await collection.insertOne({ ...activity });
    return;
  }

  const database = await getDb();
  await database.run(
    `INSERT INTO activities (
      id, user_id, type, title, description, priority, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      activity.id,
      activity.userId,
      activity.type,
      activity.title,
      activity.description,
      activity.priority,
      activity.status,
      activity.createdAt,
      activity.updatedAt
    ]
  );
}

export async function listActivitiesByUserId(userId) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("activities");
    const rows = await collection.find({ userId }).sort({ createdAt: -1 }).toArray();
    return rows.map(stripMongoId);
  }

  const database = await getDb();
  return database.all(
    `SELECT ${activitySelect}
     FROM activities
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );
}

export async function listActivitiesForDate(dateKey) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("activities");
    const rows = await collection
      .find({ createdAt: { $regex: `^${dateKey}` } })
      .sort({ createdAt: -1 })
      .toArray();
    return rows.map(stripMongoId);
  }

  const database = await getDb();
  return database.all(
    `SELECT ${activitySelect}
     FROM activities
     WHERE substr(created_at, 1, 10) = ?
     ORDER BY created_at DESC`,
    [dateKey]
  );
}

export async function listAllActivities() {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("activities");
    const rows = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return rows.map(stripMongoId);
  }

  const database = await getDb();
  return database.all(`SELECT ${activitySelect} FROM activities ORDER BY created_at DESC`);
}
