import { getDb } from "../database/connection.js";
import { getMongoCollection, isMongoEnabled, stripMongoId } from "../database/mongo.js";
export {
  defaultOrganizationCode,
  defaultOrganizationId
} from "../services/organizationDefaults.js";

const organizationSelect = `
  id,
  name,
  code,
  contact_email AS contactEmail,
  phone,
  logo_url AS logoUrl,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const subscriptionSelect = `
  id,
  organization_id AS organizationId,
  plan,
  status,
  guard_limit AS guardLimit,
  starts_at AS startsAt,
  renews_at AS renewsAt,
  expires_at AS expiresAt,
  notes,
  updated_at AS updatedAt
`;

function normalizeOrganization(row) {
  return row ? stripMongoId(row) : null;
}

function normalizeSubscription(row) {
  return row ? stripMongoId(row) : null;
}

export async function findOrganizationById(id) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("organizations");
    return normalizeOrganization(await collection.findOne({ id }));
  }

  const database = await getDb();
  return database.get(`SELECT ${organizationSelect} FROM organizations WHERE id = ?`, [id]);
}

export async function findOrganizationByCode(code) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("organizations");
    return normalizeOrganization(await collection.findOne({ code }));
  }

  const database = await getDb();
  return database.get(`SELECT ${organizationSelect} FROM organizations WHERE code = ?`, [code]);
}

export async function createOrganization(organization) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("organizations");
    await collection.insertOne({ ...organization });
    return findOrganizationById(organization.id);
  }

  const database = await getDb();
  await database.run(
    `INSERT INTO organizations (
      id, name, code, contact_email, phone, logo_url, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organization.id,
      organization.name,
      organization.code,
      organization.contactEmail,
      organization.phone,
      organization.logoUrl ?? null,
      organization.status,
      organization.createdAt,
      organization.updatedAt
    ]
  );

  return findOrganizationById(organization.id);
}

export async function updateOrganization(id, organization) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("organizations");
    await collection.updateOne(
      { id },
      {
        $set: {
          name: organization.name,
          code: organization.code,
          contactEmail: organization.contactEmail,
          phone: organization.phone,
          logoUrl: organization.logoUrl ?? null,
          status: organization.status,
          updatedAt: organization.updatedAt
        }
      }
    );
    return findOrganizationById(id);
  }

  const database = await getDb();
  await database.run(
    `UPDATE organizations
     SET name = ?, code = ?, contact_email = ?, phone = ?, logo_url = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [
      organization.name,
      organization.code,
      organization.contactEmail,
      organization.phone,
      organization.logoUrl ?? null,
      organization.status,
      organization.updatedAt,
      id
    ]
  );

  return findOrganizationById(id);
}

export async function upsertOrganizationSubscription(subscription) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("organization_subscriptions");
    await collection.updateOne(
      { organizationId: subscription.organizationId },
      { $set: { ...subscription } },
      { upsert: true }
    );
    return findOrganizationSubscription(subscription.organizationId);
  }

  const database = await getDb();
  await database.run(
    `INSERT INTO organization_subscriptions (
      id, organization_id, plan, status, guard_limit, starts_at, renews_at, expires_at, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id) DO UPDATE SET
      plan = excluded.plan,
      status = excluded.status,
      guard_limit = excluded.guard_limit,
      starts_at = excluded.starts_at,
      renews_at = excluded.renews_at,
      expires_at = excluded.expires_at,
      notes = excluded.notes,
      updated_at = excluded.updated_at`,
    [
      subscription.id,
      subscription.organizationId,
      subscription.plan,
      subscription.status,
      subscription.guardLimit,
      subscription.startsAt,
      subscription.renewsAt,
      subscription.expiresAt,
      subscription.notes,
      subscription.updatedAt
    ]
  );

  return findOrganizationSubscription(subscription.organizationId);
}

export async function findOrganizationSubscription(organizationId) {
  if (isMongoEnabled()) {
    const collection = await getMongoCollection("organization_subscriptions");
    return normalizeSubscription(await collection.findOne({ organizationId }));
  }

  const database = await getDb();
  return database.get(
    `SELECT ${subscriptionSelect}
     FROM organization_subscriptions
     WHERE organization_id = ?`,
    [organizationId]
  );
}

export async function listOrganizations() {
  if (isMongoEnabled()) {
    const [organizations, subscriptions] = await Promise.all([
      getMongoCollection("organizations"),
      getMongoCollection("organization_subscriptions")
    ]);
    const [organizationRows, subscriptionRows] = await Promise.all([
      organizations.find({}).sort({ name: 1 }).toArray(),
      subscriptions.find({}).toArray()
    ]);
    const subscriptionLookup = new Map(
      subscriptionRows.map((subscription) => [
        subscription.organizationId,
        normalizeSubscription(subscription)
      ])
    );

    return organizationRows.map((organization) => ({
      ...normalizeOrganization(organization),
      subscription: subscriptionLookup.get(organization.id) || null
    }));
  }

  const database = await getDb();
  const rows = await database.all(
    `SELECT
      o.id,
      o.name,
      o.code,
      o.contact_email AS contactEmail,
      o.phone,
      o.logo_url AS logoUrl,
      o.status,
      o.created_at AS createdAt,
      o.updated_at AS updatedAt,
      s.id AS subscriptionId,
      s.plan,
      s.status AS subscriptionStatus,
      s.guard_limit AS guardLimit,
      s.starts_at AS startsAt,
      s.renews_at AS renewsAt,
      s.expires_at AS expiresAt,
      s.notes,
      s.updated_at AS subscriptionUpdatedAt
     FROM organizations o
     LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
     ORDER BY o.name ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    contactEmail: row.contactEmail,
    phone: row.phone,
    logoUrl: row.logoUrl,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    subscription: row.subscriptionId
      ? {
          id: row.subscriptionId,
          organizationId: row.id,
          plan: row.plan,
          status: row.subscriptionStatus,
          guardLimit: row.guardLimit,
          startsAt: row.startsAt,
          renewsAt: row.renewsAt,
          expiresAt: row.expiresAt,
          notes: row.notes,
          updatedAt: row.subscriptionUpdatedAt
        }
      : null
  }));
}
