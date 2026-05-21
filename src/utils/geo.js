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
