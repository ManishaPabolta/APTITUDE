export function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function validateQuestionDraft(question) {
  if (!question?.text?.trim()) return "Question text is required.";
  if (!Number.isFinite(Number(question.marks)) || Number(question.marks) <= 0) return "Marks must be greater than zero.";
  if (["single", "multiple", "reasoning"].includes(question.type) && (question.options || []).filter(Boolean).length < 2) {
    return "Choice questions need at least two options.";
  }
  return "";
}
