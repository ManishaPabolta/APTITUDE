import api from "../api";

export const generateDraft = (request) => api.post(
  "/admin/ai/questions",
  request,
  { timeout: 900000 },
).then((response) => response.data);
export const approveDraft = (draftId, questions) => api.post(`/admin/ai/drafts/${draftId}/approve`, { questions }).then((response) => response.data);
export const discardDraft = (draftId) => api.delete(`/admin/ai/drafts/${draftId}`);
export const listPendingDrafts = () => api.get("/admin/ai/drafts").then((response) => response.data);
export const getDraft = (draftId) => api.get(`/admin/ai/drafts/${draftId}`).then((response) => response.data);
