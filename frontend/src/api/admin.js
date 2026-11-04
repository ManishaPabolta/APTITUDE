import api from "../api";

export const getOverview = () => api.get("/admin/overview").then((response) => response.data);
export const listUsers = (params = {}) => api.get("/admin/users", { params }).then((response) => response.data);
export const createUser = (payload) => api.post("/admin/users", payload).then((response) => response.data);
export const updateUser = (id, payload) => api.patch(`/admin/users/${id}`, payload).then((response) => response.data);
export const importStudents = (file) => {
  const data = new FormData();
  data.append("file", file);
  return api.post("/admin/users/import", data).then((response) => response.data);
};
export const listTests = () => api.get("/admin/tests").then((response) => response.data);
export const getTest = (id) => api.get(`/admin/tests/${id}`).then((response) => response.data);
export const createTest = (payload) => api.post("/admin/tests", payload).then((response) => response.data);
export const updateTest = (id, payload) => api.put(`/admin/tests/${id}`, payload).then((response) => response.data);
export const deleteTest = (id) => api.delete(`/admin/tests/${id}`);
export const listResults = (params = {}) => api.get("/admin/results", { params }).then((response) => response.data);
export const getAnalytics = () => api.get("/admin/analytics").then((response) => response.data);
export const listStudents = () => api.get("/staff/students").then((response) => response.data);
export const listCatalog = (kind) => api.get(`/admin/${kind}`).then((response) => response.data);
export const createCatalogItem = (kind, name) => api.post(`/admin/${kind}`, { name }).then((response) => response.data);
export const deleteCatalogItem = (kind, id) => api.delete(`/admin/${kind}/${id}`);
