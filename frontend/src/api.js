import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, "");
const apiBaseUrl = normalizedApiUrl.endsWith("/api") ? normalizedApiUrl : `${normalizedApiUrl}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aptitude_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function messageFromError(error) {
  return error?.response?.data?.detail || error?.message || "Something went wrong. Please try again.";
}

export default api;
