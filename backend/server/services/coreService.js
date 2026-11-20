import { randomUUID } from "node:crypto";

export function now() {
  return new Date().toISOString();
}

export function createId() {
  return randomUUID();
}

export function getDateKey(value = now()) {
  return String(value).slice(0, 10);
}

export function getAttendanceMinutesForDay(attendance = [], dateKey = getDateKey()) {
  const dayStart = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const currentTime = Date.now();

  return attendance.reduce((total, entry) => {
    const checkInTime = new Date(entry.checkInAt).getTime();
    const checkOutTime = entry.checkOutAt
      ? new Date(entry.checkOutAt).getTime()
      : currentTime;

    if (Number.isNaN(checkInTime) || Number.isNaN(checkOutTime)) {
      return total;
    }

    const overlapStart = Math.max(checkInTime, dayStart);
    const overlapEnd = Math.min(checkOutTime, dayEnd, currentTime);

    if (overlapEnd <= overlapStart) {
      return total;
    }

    return total + Math.round((overlapEnd - overlapStart) / (1000 * 60));
  }, 0);
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function sortByNewest(items, key) {
  return [...items].sort(
    (left, right) => new Date(right[key]).getTime() - new Date(left[key]).getTime()
  );
}

export function getLatestBy(items, key) {
  return sortByNewest(items, key)[0] ?? null;
}

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
