import { hasCoordinates } from "./geo";

const storageKey = "sentinel-grid-pending-location-sync";

function normalizeQueuedLocation(payload) {
  if (!hasCoordinates(payload)) {
    return null;
  }

  return {
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    accuracy:
      payload?.accuracy !== undefined && payload?.accuracy !== null
        ? Number(payload.accuracy)
        : null,
    battery:
      payload?.battery !== undefined && payload?.battery !== null
        ? Number(payload.battery)
        : null,
    address: payload?.address ? String(payload.address).trim() : "Live location sync",
    dutyLabel: payload?.dutyLabel ? String(payload.dutyLabel).trim() : "",
    capturedAt: payload?.capturedAt || new Date().toISOString(),
    queuedAt: payload?.queuedAt || new Date().toISOString(),
    source: payload?.source || "queued",
    fallbackUsed: Boolean(payload?.fallbackUsed)
  };
}

export function getQueuedGuardLocationSync() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    const queuedLocation = normalizeQueuedLocation(JSON.parse(raw));
    return queuedLocation;
  } catch {
    return null;
  }
}

export function queueGuardLocationSync(payload) {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedLocation = normalizeQueuedLocation(payload);

  if (!normalizedLocation) {
    return null;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalizedLocation));
  } catch {
    return null;
  }

  return normalizedLocation;
}

export function clearQueuedGuardLocationSync() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore local storage cleanup failures.
  }
}

export function shouldRetryGuardLocationSync(error) {
  const status = error?.status;
  const message = String(error?.message || "").toLowerCase();

  if (!status) {
    return true;
  }

  if ([408, 425, 429].includes(status)) {
    return true;
  }

  if (status >= 500) {
    return true;
  }

  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("offline") ||
    message.includes("failed")
  );
}
