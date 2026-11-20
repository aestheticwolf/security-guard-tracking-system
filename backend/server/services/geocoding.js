const geocodeCache = new Map();
const forwardGeocodeCache = new Map();
const defaultUserAgent =
  process.env.GEOCODER_USER_AGENT?.trim() || "SentinelGrid/1.0 (local security guard tracking)";
const configuredGeocoderTimeoutMs = Number(process.env.GEOCODER_TIMEOUT_MS || 3500);
const geocoderTimeoutMs =
  Number.isFinite(configuredGeocoderTimeoutMs) && configuredGeocoderTimeoutMs > 0
    ? configuredGeocoderTimeoutMs
    : 3500;

function buildCacheKey(latitude, longitude) {
  return `${Number(latitude).toFixed(4)}:${Number(longitude).toFixed(4)}`;
}

function firstDefined(...values) {
  return values.find((value) => value && String(value).trim()) || "";
}

function buildZoneName(address = {}) {
  const primary = firstDefined(
    address.amenity,
    address.building,
    address.office,
    address.industrial,
    address.commercial,
    address.shop,
    address.road
  );
  const secondary = firstDefined(
    address.neighbourhood,
    address.suburb,
    address.city_district,
    address.village,
    address.town,
    address.city,
    address.county
  );

  return [primary, secondary].filter(Boolean).join(", ");
}

function normalizeZoneDetail(response) {
  const address = response?.address || {};
  const zoneName =
    buildZoneName(address) ||
    firstDefined(
      address.suburb,
      address.neighbourhood,
      address.village,
      address.town,
      address.city,
      response?.name,
      response?.display_name
    ) ||
    "Live field position";

  return {
    zoneName,
    zoneDetail: response?.display_name || zoneName
  };
}

function buildForwardArea(address = {}) {
  return firstDefined(
    address.neighbourhood,
    address.suburb,
    address.city_district,
    address.village,
    address.town,
    address.city,
    address.county,
    address.state
  );
}

function buildForwardName(entry = {}) {
  const address = entry.address || {};

  return (
    firstDefined(
      entry.name,
      address.amenity,
      address.building,
      address.office,
      address.commercial,
      address.shop,
      address.road,
      address.neighbourhood,
      address.suburb,
      address.village,
      address.town,
      address.city
    ) || "Selected duty site"
  );
}

function normalizeForwardResult(entry = {}) {
  const latitude = Number(entry.lat);
  const longitude = Number(entry.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const address = entry.address || {};
  const name = buildForwardName(entry);
  const area = buildForwardArea(address);
  const displayName = firstDefined(entry.display_name, [name, area].filter(Boolean).join(", "));

  return {
    id: String(entry.place_id || `${latitude}:${longitude}`),
    name,
    area,
    address: displayName,
    latitude,
    longitude,
    type: firstDefined(entry.type, entry.class, "place")
  };
}

function buildForwardCacheKey(query, limit) {
  return `${String(query || "").trim().toLowerCase()}:${limit}`;
}

export async function reverseGeocodeLocation(latitude, longitude) {
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    return null;
  }

  const cacheKey = buildCacheKey(latitude, longitude);

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const query = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      zoom: "18",
      addressdetails: "1"
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), geocoderTimeoutMs);
    let response;

    try {
      response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
        signal: controller.signal,
        headers: {
          "User-Agent": defaultUserAgent,
          Accept: "application/json"
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed with status ${response.status}`);
    }

    const data = await response.json();
    const normalized = normalizeZoneDetail(data);
    geocodeCache.set(cacheKey, normalized);
    return normalized;
  } catch {
    return null;
  }
}

export async function searchGeocodeLocations(query, options = {}) {
  const normalizedQuery = String(query || "").trim().replace(/\s+/g, " ");
  const limit = Math.min(Math.max(Number(options.limit || 5), 1), 8);

  if (normalizedQuery.length < 3) {
    return [];
  }

  const cacheKey = buildForwardCacheKey(normalizedQuery, limit);

  if (forwardGeocodeCache.has(cacheKey)) {
    return forwardGeocodeCache.get(cacheKey);
  }

  try {
    const searchQuery = new URLSearchParams({
      format: "jsonv2",
      q: normalizedQuery,
      limit: String(limit),
      addressdetails: "1"
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), geocoderTimeoutMs);
    let response;

    try {
      response = await fetch(`https://nominatim.openstreetmap.org/search?${searchQuery.toString()}`, {
        signal: controller.signal,
        headers: {
          "User-Agent": defaultUserAgent,
          Accept: "application/json"
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Place search failed with status ${response.status}`);
    }

    const data = await response.json();
    const seen = new Set();
    const locations = (Array.isArray(data) ? data : [])
      .map(normalizeForwardResult)
      .filter(Boolean)
      .filter((entry) => {
        const key = `${entry.latitude.toFixed(5)}:${entry.longitude.toFixed(5)}:${entry.name}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

    forwardGeocodeCache.set(cacheKey, locations);
    return locations;
  } catch {
    return [];
  }
}
