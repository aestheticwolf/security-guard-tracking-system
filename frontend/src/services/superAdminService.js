import { apiClient } from "./apiClient";

function hasFile(value) {
  return typeof File !== "undefined" && value instanceof File;
}

function buildOrganizationWorkspacePayload(payload) {
  if (!hasFile(payload?.adminPhoto) && !hasFile(payload?.organizationLogo)) {
    return payload;
  }

  const formData = new FormData();
  formData.append("name", payload.name || "");
  formData.append("code", payload.code || "");
  formData.append("contactEmail", payload.contactEmail || "");
  formData.append("phone", payload.phone || "");
  formData.append("status", payload.status || "");
  formData.append("subscription", JSON.stringify(payload.subscription || {}));
  formData.append("admin", JSON.stringify(payload.admin || {}));

  if (hasFile(payload?.adminPhoto)) {
    formData.append("adminPhoto", payload.adminPhoto);
  }

  if (hasFile(payload?.organizationLogo)) {
    formData.append("organizationLogo", payload.organizationLogo);
  }

  return formData;
}

function buildOrganizationAdminPayload(payload) {
  if (!hasFile(payload?.adminPhoto)) {
    return payload;
  }

  const formData = new FormData();
  formData.append("admin", JSON.stringify({
    fullName: payload.fullName || "",
    email: payload.email || "",
    password: payload.password || "",
    phone: payload.phone || ""
  }));
  formData.append("adminPhoto", payload.adminPhoto);
  return formData;
}

export async function getSuperAdminOverview() {
  const { data } = await apiClient.get("/super-admin/overview");
  return data;
}

export async function createOrganizationWorkspace(payload) {
  const { data } = await apiClient.post(
    "/super-admin/organizations",
    buildOrganizationWorkspacePayload(payload)
  );
  return data;
}

export async function updateOrganizationWorkspace(id, payload) {
  const { data } = await apiClient.patch(
    `/super-admin/organizations/${id}`,
    buildOrganizationWorkspacePayload(payload)
  );
  return data;
}

export async function createOrganizationAdmin(id, payload) {
  const { data } = await apiClient.post(
    `/super-admin/organizations/${id}/admins`,
    buildOrganizationAdminPayload(payload)
  );
  return data;
}

export async function updateOrganizationAdminProfile(organizationId, adminId, payload) {
  const formData = new FormData();

  if (hasFile(payload?.adminPhoto)) {
    formData.append("adminPhoto", payload.adminPhoto);
  }

  const { data } = await apiClient.patch(
    `/super-admin/organizations/${organizationId}/admins/${adminId}`,
    formData
  );
  return data;
}

export async function resetOrganizationAdminPassword(organizationId, adminId) {
  const { data } = await apiClient.patch(
    `/super-admin/organizations/${organizationId}/admins/${adminId}/password`
  );
  return data;
}
