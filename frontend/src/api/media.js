import api from "../api";

export async function uploadQuestionImage(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/admin/question-bank/media", form);
  return data.image_url;
}

export function resolveMediaUrl(path) {
  return path?.startsWith("/api/media/")
    ? new URL(path, api.defaults.baseURL).toString()
    : path;
}
