import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import { createId } from "../services/coreService.js";

let mongoClient;
let mongoDatabase;

export function isMongoEnabled() {
  return Boolean(process.env.MONGODB_URI);
}

function getMongoDatabaseName() {
  return process.env.MONGODB_DB_NAME || "sentinel_grid";
}

export async function getMongoDb() {
  if (!isMongoEnabled()) {
    throw new Error("MongoDB is not configured. Set MONGODB_URI to enable it.");
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    mongoDatabase = mongoClient.db(getMongoDatabaseName());
  }

  return mongoDatabase;
}

export async function getMongoCollection(name) {
  const database = await getMongoDb();
  return database.collection(name);
}

export function stripMongoId(document) {
  if (!document) {
    return null;
  }

  const { _id, ...rest } = document;
  return rest;
}

function offsetMinutes(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function createMongoIndexes(database) {
  await Promise.all([
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    database.collection("users").createIndex({ role: 1, fullName: 1 }),
    database.collection("attendance").createIndex({ userId: 1, checkInAt: -1 }),
    database.collection("activities").createIndex({ userId: 1, createdAt: -1 }),
    database.collection("locations").createIndex({ userId: 1, trackedAt: -1 }),
    database.collection("selfies").createIndex({ userId: 1, capturedAt: -1 })
  ]);
}

async function seedMongoDatabase(database) {
  const existingUsers = await database.collection("users").countDocuments();

  if (existingUsers > 0) {
    return false;
  }

  const adminId = createId();
  const guardId = createId();
  const patrolId = createId();
  const activeAttendanceId = createId();

  await database.collection("users").insertMany([
    {
      id: adminId,
      fullName: "Ava Sterling",
      email: "admin@sentinel.local",
      passwordHash: await bcrypt.hash("Admin@123", 10),
      role: "admin",
      phone: "+1 202 555 0182",
      employeeCode: "ADM-001",
      shiftLabel: "Command Center",
      status: "active",
      avatarUrl: null,
      sessionVersion: 1,
      lastLoginAt: offsetMinutes(22),
      lastSeenAt: offsetMinutes(3),
      createdAt: offsetMinutes(1440)
    },
    {
      id: guardId,
      fullName: "Marcus Hale",
      email: "guard@sentinel.local",
      passwordHash: await bcrypt.hash("Guard@123", 10),
      role: "guard",
      phone: "+1 202 555 0108",
      employeeCode: "GRD-104",
      shiftLabel: "North Perimeter",
      status: "active",
      avatarUrl: null,
      sessionVersion: 1,
      lastLoginAt: offsetMinutes(185),
      lastSeenAt: offsetMinutes(42),
      createdAt: offsetMinutes(1100)
    },
    {
      id: patrolId,
      fullName: "Nadia Brooks",
      email: "patrol@sentinel.local",
      passwordHash: await bcrypt.hash("Patrol@123", 10),
      role: "guard",
      phone: "+1 202 555 0119",
      employeeCode: "GRD-117",
      shiftLabel: "Warehouse Ring",
      status: "active",
      avatarUrl: null,
      sessionVersion: 1,
      lastLoginAt: offsetMinutes(90),
      lastSeenAt: offsetMinutes(2),
      createdAt: offsetMinutes(960)
    }
  ]);

  await database.collection("attendance").insertOne({
    id: activeAttendanceId,
    userId: patrolId,
    checkInAt: offsetMinutes(95),
    checkOutAt: null,
    status: "checked-in",
    selfiePath: null,
    locationLabel: "Warehouse Gate B",
    latitude: 38.89511,
    longitude: -77.03637,
    accuracy: 14,
    note: "Equipment check complete."
  });

  await database.collection("activities").insertMany([
    {
      id: createId(),
      userId: patrolId,
      type: "patrol",
      title: "South fence checkpoint cleared",
      description: "Routine sweep completed without anomalies.",
      priority: "medium",
      status: "logged",
      createdAt: offsetMinutes(11),
      updatedAt: offsetMinutes(11)
    },
    {
      id: createId(),
      userId: patrolId,
      type: "safety",
      title: "Dock access verified",
      description: "Visitor lane remained secured during loading rotation.",
      priority: "low",
      status: "logged",
      createdAt: offsetMinutes(28),
      updatedAt: offsetMinutes(28)
    },
    {
      id: createId(),
      userId: adminId,
      type: "command",
      title: "Night roster confirmed",
      description: "Admin console finalized tower and gate assignments.",
      priority: "medium",
      status: "logged",
      createdAt: offsetMinutes(50),
      updatedAt: offsetMinutes(50)
    }
  ]);

  await database.collection("locations").insertMany([
    {
      id: createId(),
      userId: patrolId,
      latitude: 38.8954,
      longitude: -77.0359,
      accuracy: 13,
      address: "Warehouse Ring - Sector B",
      zoneDetail: null,
      dutyLabel: null,
      battery: 72,
      trackedAt: offsetMinutes(4)
    },
    {
      id: createId(),
      userId: guardId,
      latitude: 38.8959,
      longitude: -77.0344,
      accuracy: 18,
      address: "North Perimeter",
      zoneDetail: null,
      dutyLabel: null,
      battery: 81,
      trackedAt: offsetMinutes(46)
    }
  ]);

  return true;
}

export async function initializeMongoDatabase({ reset = false } = {}) {
  const database = await getMongoDb();

  if (reset) {
    await database.dropDatabase();
  }

  await createMongoIndexes(database);
  const seeded = await seedMongoDatabase(database);

  return {
    filename: `${getMongoDatabaseName()} MongoDB database`,
    seeded
  };
}
