import { hasCoordinates } from "./geo";

const deviceLocationStorageKey = "sentinel-grid-last-device-location";
const defaultMaximumAge = 20_000;
const defaultFreshPositionMaxAge = 2 * 60_000;
const quickRecentPositionTimeout = 3_000;

function mapGeolocationError(error) {
  if (!error) {
    return "Location permission is required for live tracking.";
  }

  if (error.code === 1) {
    return "Location permission was denied on this device.";
  }

  if (error.code === 2) {
    return "Unable to determine the current device location.";
  }

  if (error.code === 3) {
    return "This device did not return a location in time. Keep location permission on and make sure device location/GPS is enabled.";
  }

  return error.message || "Unable to read device location.";
}

async function readBatteryLevel() {
  if (!navigator.getBattery) {
    return null;
  }

  try {
    const manager = await navigator.getBattery();
    return Math.round(manager.level * 100);
  } catch {
    return null;
  }
}

function normalizePosition(position, battery) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Math.round(position.coords.accuracy),
    battery,
    capturedAt: new Date(position.timestamp || Date.now()).toISOString()
  };
}

function isFreshPosition(location, maxPositionAgeMs) {
  if (!Number.isFinite(maxPositionAgeMs)) {
    return true;
  }

  const capturedAt = location?.capturedAt ? new Date(location.capturedAt).getTime() : Number.NaN;

  return Number.isFinite(capturedAt) && Date.now() - capturedAt <= maxPositionAgeMs;
}

function assertFreshPosition(location, maxPositionAgeMs) {
  if (isFreshPosition(location, maxPositionAgeMs)) {
    return;
  }

  throw new Error("The device returned an old GPS position. Please turn location on, wait for a fresh fix, and try again.");
}

function persistDeviceLocation(location) {
  if (typeof window === "undefined" || !hasCoordinates(location)) {
    return;
  }

  try {
    window.localStorage.setItem(deviceLocationStorageKey, JSON.stringify(location));
  } catch {
    // Ignore storage failures so location capture keeps working.
  }
}

export function getStoredDeviceLocation(maxAgeMs = Number.POSITIVE_INFINITY) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(deviceLocationStorageKey);

    if (!raw) {
      return null;
    }

    const location = JSON.parse(raw);
    const capturedAt = location?.capturedAt ? new Date(location.capturedAt).getTime() : NaN;

    if (!hasCoordinates(location) || Number.isNaN(capturedAt)) {
      return null;
    }

    if (Number.isFinite(maxAgeMs) && Date.now() - capturedAt > maxAgeMs) {
      return null;
    }

    return location;
  } catch {
    return null;
  }
}

function decorateLocation(location, source, fallbackUsed = false) {
  return {
    ...location,
    source,
    fallbackUsed
  };
}

async function readPositionAttempt({
  enableHighAccuracy = true,
  maximumAge = defaultMaximumAge,
  timeout = 12_000,
  maxPositionAgeMs = Number.POSITIVE_INFINITY,
  source = "browser"
} = {}) {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not available on this device.");
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy,
      timeout,
      maximumAge
    });
  }).catch((error) => {
    throw new Error(mapGeolocationError(error));
  });

  const battery = await readBatteryLevel();
  const location = normalizePosition(position, battery);
  assertFreshPosition(location, maxPositionAgeMs);
  persistDeviceLocation(location);
  return decorateLocation(location, source);
}

async function readWatchPositionAttempt({
  enableHighAccuracy = true,
  maximumAge = 0,
  timeout = 16_000,
  maxPositionAgeMs = defaultFreshPositionMaxAge,
  source = "watch"
} = {}) {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not available on this device.");
  }

  const position = await new Promise((resolve, reject) => {
    let settled = false;
    let watchId = null;
    let timeoutId = null;

    const finish = (handler, value) => {
      if (settled) {
        return;
      }

      settled = true;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }

      handler(value);
    };

    watchId = navigator.geolocation.watchPosition(
      (nextPosition) => finish(resolve, nextPosition),
      (error) => finish(reject, error),
      {
        enableHighAccuracy,
        maximumAge,
        timeout
      }
    );

    timeoutId = globalThis.setTimeout(
      () => finish(reject, { code: 3, message: "GPS did not respond in time." }),
      timeout + 1_500
    );
  }).catch((error) => {
    throw new Error(mapGeolocationError(error));
  });

  const battery = await readBatteryLevel();
  const location = normalizePosition(position, battery);
  assertFreshPosition(location, maxPositionAgeMs);
  persistDeviceLocation(location);
  return decorateLocation(location, source, source !== "watch");
}

export async function readDeviceContext(options = {}) {
  const {
    forceFresh = false,
    timeout = 12_000,
    maxPositionAgeMs = forceFresh ? defaultFreshPositionMaxAge : Number.POSITIVE_INFINITY
  } = options;

  return readPositionAttempt({
    enableHighAccuracy: true,
    maximumAge: forceFresh ? 0 : defaultMaximumAge,
    timeout,
    maxPositionAgeMs,
    source: forceFresh ? "fresh" : "browser"
  });
}

export async function readBestAvailableDeviceContext(options = {}) {
  const {
    forceFresh = false,
    timeout = 12_000,
    storedMaxAgeMs = 2 * 60_000,
    maxPositionAgeMs = forceFresh ? defaultFreshPositionMaxAge : Number.POSITIVE_INFINITY,
    watchTimeout = Math.min(Math.max(timeout, 10_000), 30_000),
    relaxedTimeout = Math.min(Math.max(timeout, 8_000), 20_000)
  } = options;

  const attempts = [];

  if (forceFresh && Number.isFinite(maxPositionAgeMs)) {
    attempts.push(() =>
      readPositionAttempt({
        enableHighAccuracy: false,
        maximumAge: maxPositionAgeMs,
        timeout: quickRecentPositionTimeout,
        maxPositionAgeMs,
        source: "recent"
      })
    );
  }

  attempts.push(
    () =>
      readPositionAttempt({
        enableHighAccuracy: true,
        maximumAge: forceFresh ? 0 : defaultMaximumAge,
        timeout,
        maxPositionAgeMs,
        source: forceFresh ? "fresh" : "browser"
      })
  );

  if (forceFresh) {
    attempts.push(() =>
      readWatchPositionAttempt({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: watchTimeout,
        maxPositionAgeMs,
        source: "watch"
      })
    );
  }

  attempts.push(() =>
    readPositionAttempt({
      enableHighAccuracy: false,
      maximumAge: forceFresh && Number.isFinite(maxPositionAgeMs) ? maxPositionAgeMs : 120_000,
      timeout: relaxedTimeout,
      maxPositionAgeMs,
      source: "relaxed"
    })
  );

  let lastError = null;

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  const storedLocation = getStoredDeviceLocation(storedMaxAgeMs);

  if (storedLocation) {
    return decorateLocation(storedLocation, "stored", true);
  }

  throw lastError || new Error("Unable to read device location.");
}

export function watchDeviceContext(onSuccess, onError) {
  if (!navigator.geolocation) {
    onError?.("Geolocation is not available on this device.");
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      try {
        const battery = await readBatteryLevel();
        const location = normalizePosition(position, battery);
        persistDeviceLocation(location);
        onSuccess?.(decorateLocation(location, "watch"));
      } catch (error) {
        onError?.(error.message || "Unable to enrich device location.");
      }
    },
    (error) => onError?.(mapGeolocationError(error)),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000
    }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
