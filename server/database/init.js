import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, getDatabasePath, getDb } from "./connection.js";
import { initializeMongoDatabase, isMongoEnabled } from "./mongo.js";
import { createId, now } from "../services/coreService.js";
import {
  defaultOrganizationCode,
  defaultOrganizationId,
  superAdminEmail
} from "../services/organizationDefaults.js";

const __filename = fileURLToPath(import.meta.url);

function offsetMinutes(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function createSchema(database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      contact_email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organization_subscriptions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'starter',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'past_due', 'cancelled')),
      guard_limit INTEGER NOT NULL DEFAULT 50,
      starts_at TEXT,
      renews_at TEXT,
      expires_at TEXT,
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS duty_sites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      area TEXT DEFAULT '',
      address TEXT DEFAULT '',
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'guard')),
      organization_id TEXT,
      duty_site_id TEXT,
      phone TEXT DEFAULT '',
      employee_code TEXT NOT NULL,
      shift_label TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      avatar_url TEXT,
      session_version INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
      FOREIGN KEY (duty_site_id) REFERENCES duty_sites(id) ON DELETE SET NULL
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
    CREATE INDEX IF NOT EXISTS idx_organizations_code ON organizations(code);
    CREATE INDEX IF NOT EXISTS idx_duty_sites_organization ON duty_sites(organization_id, status);
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
  await migrateUsersRoleConstraint(database);
  await ensureColumn(database, "locations", "zone_detail", "TEXT");
  await ensureColumn(database, "locations", "duty_label", "TEXT");
  await ensureColumn(database, "users", "organization_id", "TEXT");
  await ensureColumn(database, "users", "duty_site_id", "TEXT");
  await database.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id, role);
    CREATE INDEX IF NOT EXISTS idx_organizations_code ON organizations(code);
    CREATE INDEX IF NOT EXISTS idx_duty_sites_organization ON duty_sites(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_users_duty_site ON users(duty_site_id);
  `);
}

async function migrateUsersRoleConstraint(database) {
  const row = await database.get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'"
  );

  if (!row?.sql || row.sql.includes("super_admin")) {
    return;
  }

  await database.exec("PRAGMA foreign_keys = OFF");
  await database.exec("BEGIN");

  try {
    await database.exec("ALTER TABLE users RENAME TO users_legacy");
    await database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'guard')),
        organization_id TEXT,
        duty_site_id TEXT,
        phone TEXT DEFAULT '',
        employee_code TEXT NOT NULL,
        shift_label TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        avatar_url TEXT,
        session_version INTEGER NOT NULL DEFAULT 1,
        last_login_at TEXT,
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
        FOREIGN KEY (duty_site_id) REFERENCES duty_sites(id) ON DELETE SET NULL
      );
    `);
    await database.exec(`
      INSERT INTO users (
        id, full_name, email, password_hash, role, organization_id, duty_site_id, phone, employee_code,
        shift_label, status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      )
      SELECT
        id, full_name, email, password_hash, role, NULL, NULL, phone, employee_code,
        shift_label, status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      FROM users_legacy;
    `);
    await database.exec("DROP TABLE users_legacy");
    await database.exec("COMMIT");
  } catch (error) {
    await database.exec("ROLLBACK");
    throw error;
  } finally {
    await database.exec("PRAGMA foreign_keys = ON");
  }
}

async function ensurePlatformRecords(database) {
  const timestamp = now();

  await database.run(
    `INSERT INTO organizations (
      id, name, code, contact_email, phone, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`,
    [
      defaultOrganizationId,
      "Infipre Demo Organization",
      defaultOrganizationCode,
      "operations@infipre.local",
      "",
      "active",
      timestamp,
      timestamp
    ]
  );

  await database.run(
    `INSERT INTO organization_subscriptions (
      id, organization_id, plan, status, guard_limit, starts_at, renews_at, expires_at, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id) DO NOTHING`,
    [
      "sub-infipre-demo",
      defaultOrganizationId,
      "starter",
      "active",
      50,
      timestamp,
      null,
      null,
      "Default local workspace subscription.",
      timestamp
    ]
  );

  await database.run(
    `INSERT INTO duty_sites (
      id, organization_id, name, area, address, latitude, longitude, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`,
    [
      "site-infipre-north",
      defaultOrganizationId,
      "North Perimeter",
      "Demo campus",
      "North access and boundary patrol",
      38.8959,
      -77.0344,
      "active",
      timestamp,
      timestamp
    ]
  );

  await database.run(
    `INSERT INTO duty_sites (
      id, organization_id, name, area, address, latitude, longitude, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`,
    [
      "site-infipre-warehouse",
      defaultOrganizationId,
      "Warehouse Ring",
      "Demo campus",
      "Warehouse Gate B and loading ring",
      38.8954,
      -77.0359,
      "active",
      timestamp,
      timestamp
    ]
  );

  await database.run(
    `UPDATE users
     SET organization_id = ?
     WHERE organization_id IS NULL AND role IN ('admin', 'guard')`,
    [defaultOrganizationId]
  );

  await database.run(
    `UPDATE users
     SET duty_site_id = ?
     WHERE email = ? AND duty_site_id IS NULL`,
    ["site-infipre-north", "guard@sentinel.local"]
  );

  await database.run(
    `UPDATE users
     SET duty_site_id = ?
     WHERE email = ? AND duty_site_id IS NULL`,
    ["site-infipre-warehouse", "patrol@sentinel.local"]
  );

  const existingSuperAdmin = await database.get("SELECT id FROM users WHERE email = ?", [
    superAdminEmail
  ]);

  if (existingSuperAdmin) {
    return;
  }

  await database.run(
    `INSERT INTO users (
      id, full_name, email, password_hash, role, organization_id, duty_site_id, phone, employee_code, shift_label,
      status, avatar_url, session_version, last_login_at, last_seen_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId(),
      "Infipre Super Admin",
      superAdminEmail,
      await bcrypt.hash("Super@123", 10),
      "super_admin",
      null,
      null,
      "",
      "SUP-001",
      "Platform Owner",
      "active",
      null,
      1,
      null,
      null,
      timestamp
    ]
  );
}

async function dropSchema(database) {
  await database.exec(`
    DROP TABLE IF EXISTS selfies;
    DROP TABLE IF EXISTS locations;
    DROP TABLE IF EXISTS activities;
    DROP TABLE IF EXISTS attendance;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS organization_subscriptions;
    DROP TABLE IF EXISTS duty_sites;
    DROP TABLE IF EXISTS organizations;
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
  const northSiteId = createId();
  const warehouseSiteId = createId();
  const activeAttendanceId = createId();

  const adminPassword = await bcrypt.hash("Admin@123", 10);
  const guardPassword = await bcrypt.hash("Guard@123", 10);
  const patrolPassword = await bcrypt.hash("Patrol@123", 10);
  const superAdminPassword = await bcrypt.hash("Super@123", 10);

  await database.exec("BEGIN");

  try {
    await database.run(
      `INSERT INTO organizations (
        id, name, code, contact_email, phone, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        defaultOrganizationId,
        "Infipre Demo Organization",
        defaultOrganizationCode,
        "operations@infipre.local",
        "",
        "active",
        offsetMinutes(1500),
        offsetMinutes(1500)
      ]
    );

    await database.run(
      `INSERT INTO organization_subscriptions (
        id, organization_id, plan, status, guard_limit, starts_at, renews_at, expires_at, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "sub-infipre-demo",
        defaultOrganizationId,
        "starter",
        "active",
        50,
        offsetMinutes(1500),
        null,
        null,
        "Default local workspace subscription.",
        offsetMinutes(1500)
      ]
    );

    for (const site of [
      {
        id: northSiteId,
        name: "North Perimeter",
        area: "Demo campus",
        address: "North access and boundary patrol",
        latitude: 38.8959,
        longitude: -77.0344
      },
      {
        id: warehouseSiteId,
        name: "Warehouse Ring",
        area: "Demo campus",
        address: "Warehouse Gate B and loading ring",
        latitude: 38.8954,
        longitude: -77.0359
      }
    ]) {
      await database.run(
        `INSERT INTO duty_sites (
          id, organization_id, name, area, address, latitude, longitude, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          site.id,
          defaultOrganizationId,
          site.name,
          site.area,
          site.address,
          site.latitude,
          site.longitude,
          "active",
          offsetMinutes(1500),
          offsetMinutes(1500)
        ]
      );
    }

    await database.run(
      `INSERT INTO users (
        id, full_name, email, password_hash, role, organization_id, duty_site_id, phone, employee_code, shift_label,
        status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        "Infipre Super Admin",
        superAdminEmail,
        superAdminPassword,
        "super_admin",
        null,
        null,
        "",
        "SUP-001",
        "Platform Owner",
        "active",
        null,
        1,
        null,
        null,
        offsetMinutes(1500)
      ]
    );

    await database.run(
      `INSERT INTO users (
        id, full_name, email, password_hash, role, organization_id, duty_site_id, phone, employee_code, shift_label,
        status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        "Ava Sterling",
        "admin@sentinel.local",
        adminPassword,
        "admin",
        defaultOrganizationId,
        null,
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
        id, full_name, email, password_hash, role, organization_id, duty_site_id, phone, employee_code, shift_label,
        status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        guardId,
        "Marcus Hale",
        "guard@sentinel.local",
        guardPassword,
        "guard",
        defaultOrganizationId,
        northSiteId,
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
        id, full_name, email, password_hash, role, organization_id, duty_site_id, phone, employee_code, shift_label,
        status, avatar_url, session_version, last_login_at, last_seen_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patrolId,
        "Nadia Brooks",
        "patrol@sentinel.local",
        patrolPassword,
        "guard",
        defaultOrganizationId,
        warehouseSiteId,
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
  if (isMongoEnabled()) {
    return initializeMongoDatabase({ reset });
  }

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
  await ensurePlatformRecords(database);

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
