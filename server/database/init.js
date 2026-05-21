import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, getDatabasePath, getDb } from "./connection.js";
import { createId, now } from "../services/coreService.js";

const __filename = fileURLToPath(import.meta.url);

function offsetMinutes(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function createSchema(database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'guard')),
      phone TEXT DEFAULT '',
      employee_code TEXT NOT NULL,
      shift_label TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      avatar_url TEXT,
      session_version INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      check_in_at TEXT NOT NULL,
      check_out_at TEXT,
      status TEXT NOT NULL,
      selfie_path TEXT,
      location_label TEXT,
      latitude REAL,
      longitude REAL,
      accuracy REAL,
      note TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      address TEXT,
      zone_detail TEXT,
      duty_label TEXT,
      battery INTEGER,
      tracked_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS selfies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      attendance_id TEXT,
      image_path TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      verification_score REAL NOT NULL DEFAULT 0,
      captured_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id, check_in_at);
    CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id, tracked_at);
    CREATE INDEX IF NOT EXISTS idx_selfies_user ON selfies(user_id, captured_at);
  `);
}

async function ensureColumn(database, tableName, columnName, columnDefinition) {
  const columns = await database.all(`PRAGMA table_info(${tableName})`);

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  await database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

async function runMigrations(database) {
  await ensureColumn(database, "locations", "zone_detail", "TEXT");
  await ensureColumn(database, "locations", "duty_label", "TEXT");
}

async function dropSchema(database) {
  await database.exec(`
    DROP TABLE IF EXISTS selfies;
    DROP TABLE IF EXISTS locations;
    DROP TABLE IF EXISTS activities;
    DROP TABLE IF EXISTS attendance;
    DROP TABLE IF EXISTS users;
  `);
}

async function removeDatabaseFiles() {
  const databasePath = getDatabasePath();

  for (const candidate of [
    databasePath,
    `${databasePath}-journal`,
    `${databasePath}-wal`,
    `${databasePath}-shm`
  ]) {
    await fs.rm(candidate, { force: true }).catch(() => undefined);
  }
}

async function seedDatabase(database) {
  const existingUsers = await database.get("SELECT COUNT(*) AS count FROM users");

  if ((existingUsers?.count || 0) > 0) {
    return false;
  }

  const adminId = createId();
  const guardId = createId();
  const patrolId = createId();
  const activeAttendanceId = createId();

  const adminPassword = await bcrypt.hash("Admin@123", 10);
  const guardPassword = await bcrypt.hash("Guard@123", 10);
  const patrolPassword = await bcrypt.hash("Patrol@123", 10);

  await database.exec("BEGIN");

  try {
    await database.run(
      `INSERT INTO users (
        id, full_name, email, password_hash, role, phone, employee_code, shift_label,
        status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        "Ava Sterling",
        "admin@sentinel.local",
        adminPassword,
        "admin",
        "+1 202 555 0182",
        "ADM-001",
        "Command Center",
        "active",
        null,
        1,
        offsetMinutes(22),
        offsetMinutes(3),
        offsetMinutes(1440)
      ]
    );

    await database.run(
      `INSERT INTO users (
        id, full_name, email, password_hash, role, phone, employee_code, shift_label,
        status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        guardId,
        "Marcus Hale",
        "guard@sentinel.local",
        guardPassword,
        "guard",
        "+1 202 555 0108",
        "GRD-104",
        "North Perimeter",
        "active",
        null,
        1,
        offsetMinutes(185),
        offsetMinutes(42),
        offsetMinutes(1100)
      ]
    );

    await database.run(
      `INSERT INTO users (
        id, full_name, email, password_hash, role, phone, employee_code, shift_label,
        status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patrolId,
        "Nadia Brooks",
        "patrol@sentinel.local",
        patrolPassword,
        "guard",
        "+1 202 555 0119",
        "GRD-117",
        "Warehouse Ring",
        "active",
        null,
        1,
        offsetMinutes(90),
        offsetMinutes(2),
        offsetMinutes(960)
      ]
    );

    await database.run(
      `INSERT INTO attendance (
        id, user_id, check_in_at, check_out_at, status, selfie_path, location_label,
        latitude, longitude, accuracy, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activeAttendanceId,
        patrolId,
        offsetMinutes(95),
        null,
        "checked-in",
        null,
        "Warehouse Gate B",
        38.89511,
        -77.03637,
        14,
        "Equipment check complete."
      ]
    );

    for (const entry of [
      [
        createId(),
        patrolId,
        "patrol",
        "South fence checkpoint cleared",
        "Routine sweep completed without anomalies.",
        "medium",
        "logged",
        offsetMinutes(11)
      ],
      [
        createId(),
        patrolId,
        "safety",
        "Dock access verified",
        "Visitor lane remained secured during loading rotation.",
        "low",
        "logged",
        offsetMinutes(28)
      ],
      [
        createId(),
        adminId,
        "command",
        "Night roster confirmed",
        "Admin console finalized tower and gate assignments.",
        "medium",
        "logged",
        offsetMinutes(50)
      ]
    ]) {
      await database.run(
        `INSERT INTO activities (
          id, user_id, type, title, description, priority, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...entry, entry[7]]
      );
    }

    for (const locationEntry of [
      [
        createId(),
        patrolId,
        38.8954,
        -77.0359,
        13,
        "Warehouse Ring - Sector B",
        72,
        offsetMinutes(4)
      ],
      [
        createId(),
        guardId,
        38.8959,
        -77.0344,
        18,
        "North Perimeter",
        81,
        offsetMinutes(46)
      ]
    ]) {
      await database.run(
        `INSERT INTO locations (
          id, user_id, latitude, longitude, accuracy, address, battery, tracked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        locationEntry
      );
    }

    await database.exec("COMMIT");
    return true;
  } catch (error) {
    await database.exec("ROLLBACK");
    throw error;
  }
}

export async function initializeDatabase({ reset = false } = {}) {
  if (reset) {
    await closeDb();
    await removeDatabaseFiles();
  }

  const database = await getDb();

  if (reset) {
    await dropSchema(database);
  }

  await createSchema(database);
  await runMigrations(database);
  const seeded = await seedDatabase(database);

  return {
    filename: getDatabasePath(),
    seeded
  };
}

async function runCli() {
  const reset = process.argv.includes("--reset");
  const result = await initializeDatabase({ reset });
  const modeLabel = reset ? "reset and initialized" : "initialized";
  const seedLabel = result.seeded ? "with demo data" : "with existing data left intact";
  console.log(`SQLite database ${modeLabel} at ${result.filename} ${seedLabel}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
