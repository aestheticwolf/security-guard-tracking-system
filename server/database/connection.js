import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

let databasePromise;

export function getDatabasePath() {
  const configuredPath = process.env.DB_FILE;
  const defaultPath = path.join(
    process.env.TEMP ||
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Temp"),
    "SentinelGrid",
    "security.db"
  );
  const finalPath = configuredPath || defaultPath;
  return path.isAbsolute(finalPath) ? finalPath : path.resolve(process.cwd(), finalPath);
}

async function createConnection() {
  const [{ default: sqlite3 }, { open }] = await Promise.all([
    import("sqlite3"),
    import("sqlite")
  ]);
  const filename = getDatabasePath();
  await fs.mkdir(path.dirname(filename), { recursive: true });

  const database = await open({
    filename,
    driver: sqlite3.Database
  });

  await database.exec("PRAGMA foreign_keys = ON;");
  return database;
}

export async function getDb() {
  if (!databasePromise) {
    databasePromise = createConnection();
  }

  return databasePromise;
}

export async function closeDb() {
  if (!databasePromise) {
    return;
  }

  const database = await databasePromise;
  await database.close();
  databasePromise = null;
}
