import { apiClient } from "./apiClient";

export async function loginUser(credentials) {
  const { data } = await apiClient.post("/auth/login", credentials);
  return data;
}

export async function getCurrentUser() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}

export async function logoutUser() {
  const { data } = await apiClient.post("/auth/logout");
  return data;
}
