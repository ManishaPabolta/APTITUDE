import api from "../api";

export async function login(credentials) {
  return api.post("/auth/login", credentials).then((response) => response.data);
}

export async function registerStudent(payload) {
  return api.post("/auth/register", { ...payload, role: "student" }).then((response) => response.data);
}
