import { apiClient } from "./apiClient";

export async function getSuperAdminOverview() {
  const { data } = await apiClient.get("/super-admin/overview");
  return data;
}

export async function createOrganizationWorkspace(payload) {
  const { data } = await apiClient.post("/super-admin/organizations", payload);
  return data;
}

export async function updateOrganizationWorkspace(id, payload) {
  const { data } = await apiClient.patch(`/super-admin/organizations/${id}`, payload);
  return data;
}

export async function createOrganizationAdmin(id, payload) {
  const { data } = await apiClient.post(`/super-admin/organizations/${id}/admins`, payload);
  return data;
}

export async function resetOrganizationAdminPassword(organizationId, adminId) {
  const { data } = await apiClient.patch(
    `/super-admin/organizations/${organizationId}/admins/${adminId}/password`
  );
  return data;
}
