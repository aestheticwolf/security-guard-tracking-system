const geocodeCache = new Map();
const defaultUserAgent =
  process.env.GEOCODER_USER_AGENT?.trim() || "SentinelGrid/1.0 (local security guard tracking)";

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
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
      headers: {
        "User-Agent": defaultUserAgent,
        Accept: "application/json"
      }
    });

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
