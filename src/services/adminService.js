import { apiClient } from "./apiClient";

function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export async function getAdminOverview(options = {}) {
  const {
    retries = 1,
    retryDelayMs = 900
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { data } = await apiClient.get("/admin/overview");
      return data;
    } catch (error) {
      lastError = error;

      if (attempt >= retries) {
        throw error;
      }

      await wait(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError || new Error("Unable to load admin overview.");
}

export async function createGuardAccount(payload) {
  const { data } = await apiClient.post("/admin/guards", payload);
  return data;
}

export async function createDutySite(payload) {
  const { data } = await apiClient.post("/admin/duty-sites", payload);
  return data;
}

export async function updateDutySite(id, payload) {
  const { data } = await apiClient.patch(`/admin/duty-sites/${id}`, payload);
  return data;
}

export async function updateGuardProfile(id, payload) {
  const { data } = await apiClient.patch(`/admin/guards/${id}`, payload);
  return data;
}

export async function updateGuardAccess(id, payload) {
  const { data } = await apiClient.patch(`/admin/guards/${id}/status`, payload);
  return data;
}

export async function deleteGuardAccount(id) {
  const { data } = await apiClient.delete(`/admin/guards/${id}`);
  return data;
}
