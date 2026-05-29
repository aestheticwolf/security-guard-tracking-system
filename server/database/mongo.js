import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import { createId } from "../services/coreService.js";
import {
  defaultOrganizationCode,
  defaultOrganizationId,
  superAdminEmail
} from "../services/organizationDefaults.js";

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
    database.collection("users").createIndex({ organizationId: 1, role: 1 }),
    database.collection("organizations").createIndex({ code: 1 }, { unique: true }),
    database.collection("organization_subscriptions").createIndex({ organizationId: 1 }, { unique: true }),
    database.collection("duty_sites").createIndex({ organizationId: 1, status: 1 }),
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
  const northSiteId = createId();
  const warehouseSiteId = createId();
  const activeAttendanceId = createId();

  await database.collection("organizations").insertOne({
    id: defaultOrganizationId,
    name: "Infipre Demo Organization",
    code: defaultOrganizationCode,
    contactEmail: "operations@infipre.local",
    phone: "",
    logoUrl: null,
    status: "active",
    createdAt: offsetMinutes(1500),
    updatedAt: offsetMinutes(1500)
  });

  await database.collection("organization_subscriptions").insertOne({
    id: "sub-infipre-demo",
    organizationId: defaultOrganizationId,
    plan: "starter",
    status: "active",
    guardLimit: 50,
    startsAt: offsetMinutes(1500),
    renewsAt: null,
    expiresAt: null,
    notes: "Default local workspace subscription.",
    updatedAt: offsetMinutes(1500)
  });

  await database.collection("duty_sites").insertMany([
    {
      id: northSiteId,
      organizationId: defaultOrganizationId,
      name: "North Perimeter",
      area: "Demo campus",
      address: "North access and boundary patrol",
      latitude: 38.8959,
      longitude: -77.0344,
      status: "active",
      createdAt: offsetMinutes(1500),
      updatedAt: offsetMinutes(1500)
    },
    {
      id: warehouseSiteId,
      organizationId: defaultOrganizationId,
      name: "Warehouse Ring",
      area: "Demo campus",
      address: "Warehouse Gate B and loading ring",
      latitude: 38.8954,
      longitude: -77.0359,
      status: "active",
      createdAt: offsetMinutes(1500),
      updatedAt: offsetMinutes(1500)
    }
  ]);

  await database.collection("users").insertMany([
    {
      id: createId(),
      fullName: "Infipre Super Admin",
      email: superAdminEmail,
      passwordHash: await bcrypt.hash("Super@123", 10),
      role: "super_admin",
      organizationId: null,
      dutySiteId: null,
      phone: "",
      employeeCode: "SUP-001",
      shiftLabel: "Platform Owner",
      status: "active",
      avatarUrl: null,
      sessionVersion: 1,
      lastLoginAt: null,
      lastSeenAt: null,
      createdAt: offsetMinutes(1500)
    },
    {
      id: adminId,
      fullName: "Ava Sterling",
      email: "admin@sentinel.local",
      passwordHash: await bcrypt.hash("Admin@123", 10),
      role: "admin",
      organizationId: defaultOrganizationId,
      dutySiteId: null,
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
      organizationId: defaultOrganizationId,
      dutySiteId: northSiteId,
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
      organizationId: defaultOrganizationId,
      dutySiteId: warehouseSiteId,
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

async function ensureMongoPlatformRecords(database) {
  const timestamp = new Date().toISOString();

  await database.collection("organizations").updateOne(
    { id: defaultOrganizationId },
    {
      $setOnInsert: {
        id: defaultOrganizationId,
        name: "Infipre Demo Organization",
        code: defaultOrganizationCode,
        contactEmail: "operations@infipre.local",
        phone: "",
        logoUrl: null,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    },
    { upsert: true }
  );

  await database.collection("organization_subscriptions").updateOne(
    { organizationId: defaultOrganizationId },
    {
      $setOnInsert: {
        id: "sub-infipre-demo",
        organizationId: defaultOrganizationId,
        plan: "starter",
        status: "active",
        guardLimit: 50,
        startsAt: timestamp,
        renewsAt: null,
        expiresAt: null,
        notes: "Default local workspace subscription.",
        updatedAt: timestamp
      }
    },
    { upsert: true }
  );

  await database.collection("duty_sites").updateOne(
    { id: "site-infipre-north" },
    {
      $setOnInsert: {
        id: "site-infipre-north",
        organizationId: defaultOrganizationId,
        name: "North Perimeter",
        area: "Demo campus",
        address: "North access and boundary patrol",
        latitude: 38.8959,
        longitude: -77.0344,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    },
    { upsert: true }
  );

  await database.collection("duty_sites").updateOne(
    { id: "site-infipre-warehouse" },
    {
      $setOnInsert: {
        id: "site-infipre-warehouse",
        organizationId: defaultOrganizationId,
        name: "Warehouse Ring",
        area: "Demo campus",
        address: "Warehouse Gate B and loading ring",
        latitude: 38.8954,
        longitude: -77.0359,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    },
    { upsert: true }
  );

  await database.collection("users").updateMany(
    {
      role: { $in: ["admin", "guard"] },
      $or: [{ organizationId: { $exists: false } }, { organizationId: null }]
    },
    { $set: { organizationId: defaultOrganizationId } }
  );

  await database.collection("users").updateMany(
    { dutySiteId: { $exists: false } },
    { $set: { dutySiteId: null } }
  );

  await database.collection("users").updateMany(
    { identityPhotoPath: { $exists: false } },
    { $set: { identityPhotoPath: null, identitySelfiePath: null, identityEnrolledAt: null } }
  );

  await database.collection("users").updateOne(
    { email: "guard@sentinel.local", dutySiteId: null },
    { $set: { dutySiteId: "site-infipre-north" } }
  );

  await database.collection("users").updateOne(
    { email: "patrol@sentinel.local", dutySiteId: null },
    { $set: { dutySiteId: "site-infipre-warehouse" } }
  );

  const existingSuperAdmin = await database.collection("users").findOne({
    email: superAdminEmail
  });

  if (existingSuperAdmin) {
    return;
  }

  await database.collection("users").insertOne({
    id: createId(),
    fullName: "Infipre Super Admin",
    email: superAdminEmail,
    passwordHash: await bcrypt.hash("Super@123", 10),
    role: "super_admin",
    organizationId: null,
    dutySiteId: null,
    phone: "",
    employeeCode: "SUP-001",
    shiftLabel: "Platform Owner",
    status: "active",
    avatarUrl: null,
    sessionVersion: 1,
    lastLoginAt: null,
    lastSeenAt: null,
    createdAt: timestamp
  });
}

export async function initializeMongoDatabase({ reset = false } = {}) {
  const database = await getMongoDb();

  if (reset) {
    await database.dropDatabase();
  }

  await createMongoIndexes(database);
  const seeded = await seedMongoDatabase(database);
  await ensureMongoPlatformRecords(database);

  return {
    filename: `${getMongoDatabaseName()} MongoDB database`,
    seeded
  };
}
