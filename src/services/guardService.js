import { apiClient } from "./apiClient";

function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export async function getGuardOverview() {
  const { data } = await apiClient.get("/guard/overview");
  return data;
}

export async function getGuardActivities() {
  const { data } = await apiClient.get("/guard/activities");
  return data;
}

export async function checkInGuard(formData) {
  const { data } = await apiClient.post("/guard/attendance/check-in", formData);
  return data;
}

export async function checkOutGuard(payload) {
  const { data } = await apiClient.post("/guard/attendance/check-out", payload);
  return data;
}

export async function createGuardActivity(payload) {
  const { data } = await apiClient.post("/guard/activity", payload);
  return data;
}

export async function syncGuardLocation(payload, options = {}) {
  const {
    retries = 1,
    retryDelayMs = 900
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { data } = await apiClient.post("/guard/location", payload);
      return data;
    } catch (error) {
      lastError = error;

      if (attempt >= retries) {
        throw error;
      }

      await wait(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError || new Error("Unable to sync guard location.");
}
