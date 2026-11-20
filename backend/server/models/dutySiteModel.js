import { getDb } from "../database/connection.js";
import { getMongoCollection, isMongoEnabled, stripMongoId } from "../database/mongo.js";

const dutySiteSelect = `
  id,
  organization_id AS organizationId,
  name,
  area,
  address,
  latitude,
  longitude,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function normalizeDutySite(row) {
  return row ? stripMongoId(row) : null;
}

export async function findDutySiteById(id, organizationId = null) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("duty_sites");
    return normalizeDutySite(
      await collection.findOne({
        id,
        ...(organizationId ? { organizationId } : {})
      })
    );
  }

  const database = await getDb();

  if (organizationId) {
    return database.get(
      `SELECT ${dutySiteSelect}
       FROM duty_sites
       WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );
  }

  return database.get(`SELECT ${dutySiteSelect} FROM duty_sites WHERE id = ?`, [id]);
}

export async function listDutySites(organizationId) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("duty_sites");
    return collection
      .find({ organizationId })
      .sort({ status: 1, name: 1 })
      .toArray()
      .then((rows) => rows.map(normalizeDutySite));
  }

  const database = await getDb();
  return database.all(
    `SELECT ${dutySiteSelect}
     FROM duty_sites
     WHERE organization_id = ?
     ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, name ASC`,
    [organizationId]
  );
}

export async function createDutySite(site) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("duty_sites");
    await collection.insertOne({ ...site });
    return findDutySiteById(site.id, site.organizationId);
  }

  const database = await getDb();
  await database.run(
    `INSERT INTO duty_sites (
      id, organization_id, name, area, address, latitude, longitude, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      site.id,
      site.organizationId,
      site.name,
      site.area,
      site.address,
      site.latitude,
      site.longitude,
      site.status,
      site.createdAt,
      site.updatedAt
    ]
  );

  return findDutySiteById(site.id, site.organizationId);
}

export async function updateDutySite(id, organizationId, site) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("duty_sites");
    await collection.updateOne(
      { id, organizationId },
      {
        $set: {
          name: site.name,
          area: site.area,
          address: site.address,
          latitude: site.latitude,
          longitude: site.longitude,
          status: site.status,
          updatedAt: site.updatedAt
        }
      }
    );
    return findDutySiteById(id, organizationId);
  }

  const database = await getDb();
  await database.run(
    `UPDATE duty_sites
     SET name = ?,
         area = ?,
         address = ?,
         latitude = ?,
         longitude = ?,
         status = ?,
         updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      site.name,
      site.area,
      site.address,
      site.latitude,
      site.longitude,
      site.status,
      site.updatedAt,
      id,
      organizationId
    ]
  );

  return findDutySiteById(id, organizationId);
}
