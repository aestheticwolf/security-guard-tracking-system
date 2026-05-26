export function hasCoordinates(location) {
  return (
    location?.latitude !== undefined &&
    location?.longitude !== undefined &&
    location?.latitude !== null &&
    location?.longitude !== null
  );
}

export function toLatLng(location) {
  if (!hasCoordinates(location)) {
    return null;
  }

  return [Number(location.latitude), Number(location.longitude)];
}

export function getDistanceMeters(firstLocation, secondLocation) {
  if (!hasCoordinates(firstLocation) || !hasCoordinates(secondLocation)) {
    return Number.POSITIVE_INFINITY;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const firstLatitude = Number(firstLocation.latitude);
  const secondLatitude = Number(secondLocation.latitude);
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(
    Number(secondLocation.longitude) - Number(firstLocation.longitude)
  );
  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(toRadians(firstLatitude)) *
      Math.cos(toRadians(secondLatitude)) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function dedupeLocations(locations = []) {
  const seen = new Set();

  return locations.filter((location) => {
    if (!hasCoordinates(location)) {
      return false;
    }

    const key = `${Number(location.latitude).toFixed(5)}:${Number(location.longitude).toFixed(5)}:${location.trackedAt || location.capturedAt || ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getLocationAccuracyMeters(location) {
  const numericValue = Number(location?.accuracy);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function isReliableRoutePoint(location, maxPointAccuracyMeters) {
  if (!hasCoordinates(location)) {
    return false;
  }

  const accuracyMeters = getLocationAccuracyMeters(location);

  if (accuracyMeters === null) {
    return true;
  }

  return accuracyMeters <= maxPointAccuracyMeters;
}

function getLocationTimestampMs(location) {
  if (!location) {
    return Number.NaN;
  }

  return new Date(location.trackedAt || location.capturedAt || "").getTime();
}

export function sortLocationsByNewest(locations = []) {
  return [...locations]
    .map((location, index) => ({
      location,
      index,
      timestamp: getLocationTimestampMs(location)
    }))
    .sort((left, right) => {
      const leftHasTimestamp = Number.isFinite(left.timestamp);
      const rightHasTimestamp = Number.isFinite(right.timestamp);

      if (leftHasTimestamp && rightHasTimestamp && left.timestamp !== right.timestamp) {
        return right.timestamp - left.timestamp;
      }

      if (leftHasTimestamp !== rightHasTimestamp) {
        return leftHasTimestamp ? -1 : 1;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.location);
}

export function buildContiguousLocationTrail(
  recentLocations = [],
  currentLocation = null,
  {
    duplicateDistanceMeters = 8,
    maxSegmentDistanceMeters = 50_000,
    maxPointAccuracyMeters = 250
  } = {}
) {
  const orderedRecentLocations = sortLocationsByNewest(dedupeLocations(recentLocations)).filter(
    (location) => isReliableRoutePoint(location, maxPointAccuracyMeters)
  );
  const hasCurrentLocation = hasCoordinates(currentLocation);
  const canUseCurrentLocationInRoute = isReliableRoutePoint(
    currentLocation,
    maxPointAccuracyMeters
  );
  const newestPoint = canUseCurrentLocationInRoute
    ? currentLocation
    : orderedRecentLocations[0] || null;

  if (!newestPoint) {
    return hasCurrentLocation ? [currentLocation] : [];
  }

  const sharesLatestTrailPoint =
    canUseCurrentLocationInRoute &&
    orderedRecentLocations.length &&
    getDistanceMeters(orderedRecentLocations[0], currentLocation) <= duplicateDistanceMeters;
  const newestFirstTrail =
    sharesLatestTrailPoint
      ? [currentLocation, ...orderedRecentLocations.slice(1)]
      : canUseCurrentLocationInRoute
        ? [currentLocation, ...orderedRecentLocations]
        : orderedRecentLocations;

  const contiguousNewestFirstTrail = [newestFirstTrail[0]];

  for (let index = 1; index < newestFirstTrail.length; index += 1) {
    const previousPoint = contiguousNewestFirstTrail[contiguousNewestFirstTrail.length - 1];
    const nextPoint = newestFirstTrail[index];

    if (getDistanceMeters(previousPoint, nextPoint) > maxSegmentDistanceMeters) {
      break;
    }

    contiguousNewestFirstTrail.push(nextPoint);
  }

  return contiguousNewestFirstTrail.reverse();
}

export function getLatestReportedBattery(locations = []) {
  return sortLocationsByNewest(Array.isArray(locations) ? locations.filter(Boolean) : [locations])
    .map((location) => {
      const numericValue = Number(location?.battery);

      if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
        return null;
      }

      return Math.round(numericValue);
    })
    .find((value) => value !== null) ?? null;
}
