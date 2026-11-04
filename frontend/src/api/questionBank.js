import api from "../api";

export const listQuestionBank = (params = {}) => api.get("/admin/question-bank", { params }).then((response) => response.data);
export const downloadQuestionBank = () => api.get("/admin/question-bank/export", { responseType: "blob" }).then((response) => response.data);
export const createBankQuestion = (question) => api.post("/admin/question-bank", question).then((response) => response.data);
export const updateBankQuestion = (id, question) => api.patch(`/admin/question-bank/${id}`, question).then((response) => response.data);
export const deleteBankQuestion = (id) => api.delete(`/admin/question-bank/${id}`);
