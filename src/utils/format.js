export function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatRelative(value) {
  if (!value) {
    return "just now";
  }

  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const units = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60]
  ];

  for (const [label, amount] of units) {
    if (seconds >= amount) {
      const count = Math.round(seconds / amount);
      return `${count} ${label}${count === 1 ? "" : "s"} ago`;
    }
  }

  return "moments ago";
}

export function formatPositionFreshness(value) {
  if (!value) {
    return "Awaiting sync";
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Awaiting sync";
  }

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (seconds < 15) {
    return "Live now";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  if (seconds < 3_600) {
    return `${Math.round(seconds / 60)}m ago`;
  }

  if (seconds < 86_400) {
    return `${Math.round(seconds / 3_600)}h ago`;
  }

  return `${Math.round(seconds / 86_400)}d ago`;
}

export function formatDurationMinutes(value) {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours && remainingMinutes) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}

function normalizeDisplayText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function uniqueDisplayValues(...values) {
  const seen = new Set();

  return values
    .map(normalizeDisplayText)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export function getLocationDisplayLines(location) {
  return uniqueDisplayValues(location?.address, location?.zoneDetail);
}

export function formatBatteryStatus(value) {
  if (value === undefined || value === null || value === "") {
    return "Not reported";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    return "Not reported";
  }

  return `Approx. ${Math.round(numericValue)}%`;
}

export function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatCoordinates(location, precision = 5) {
  if (
    location?.latitude === undefined ||
    location?.longitude === undefined ||
    location?.latitude === null ||
    location?.longitude === null
  ) {
    return "Location unavailable";
  }

  return `${Number(location.latitude).toFixed(precision)}, ${Number(location.longitude).toFixed(precision)}`;
}
