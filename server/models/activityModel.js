import { getDb } from "../database/connection.js";

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
  const database = await getDb();
  return database.all(`SELECT ${activitySelect} FROM activities ORDER BY created_at DESC`);
}
