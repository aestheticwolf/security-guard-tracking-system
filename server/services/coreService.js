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
