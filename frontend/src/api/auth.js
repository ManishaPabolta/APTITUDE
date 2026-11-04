import api from "../api";

export async function login(credentials) {
  return api.post("/auth/login", credentials, { timeout: 90000 }).then((response) => response.data);
}

export async function registerStudent(payload) {
  return api.post("/auth/register", { ...payload, role: "student" }, { timeout: 90000 }).then((response) => response.data);
}
