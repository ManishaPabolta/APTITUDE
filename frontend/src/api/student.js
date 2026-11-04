import api from "../api";

export const getAssignedTests = () => api.get("/student/tests").then((response) => response.data);
export const getMyResults = () => api.get("/student/results").then((response) => response.data);
export const updateMyProfile = (payload) => api.patch("/profile", payload).then((response) => response.data);
export const getLeaderboard = (testId) => api.get("/leaderboard", { params: testId ? { test_id: testId } : {} }).then((response) => response.data);
