import axios from "axios";
import { getStoredSession } from "../utils/sessionStorage";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const requestTimeoutMs = 75_000;

export const apiClient = axios.create({
  baseURL,
  timeout: requestTimeoutMs
});

apiClient.interceptors.request.use((config) => {
  const session = getStoredSession();

  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message;
    const timedOut = error.code === "ECONNABORTED" || /timeout/i.test(error.message || "");
    const rawMessage = serverMessage || error.message || "Request failed.";
    const safeMessage =
      timedOut
        ? "The request is taking too long. Check your connection and try again."
        : status >= 500
        ? "The backend could not complete the request. Please try again in a moment."
        : rawMessage;
    const wrappedError = new Error(safeMessage);
    wrappedError.status = error.response?.status;
    return Promise.reject(wrappedError);
  }
);

export function buildAssetUrl(pathname) {
  if (!pathname) {
    return null;
  }

  if (/^https?:\/\//i.test(pathname)) {
    return pathname;
  }

  const assetBase = baseURL.endsWith("/api") ? baseURL.slice(0, -4) : baseURL;
  return `${assetBase}${pathname}`;
}
