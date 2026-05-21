import axios from "axios";
import { getStoredSession } from "../utils/sessionStorage";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const apiClient = axios.create({
  baseURL
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
    const rawMessage = serverMessage || error.message || "Request failed.";
    const safeMessage =
      status >= 500
        ? "The local backend could not complete the request. Please restart the app server and try again."
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
