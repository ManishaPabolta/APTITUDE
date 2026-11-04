import { useEffect, useState } from "react";
import { Bot, LoaderCircle, Sparkles, X } from "lucide-react";
import { approveDraft, generateDraft, getDraft, listPendingDrafts } from "../../api/aiQuestions";
import { messageFromError } from "../../api";
import { Button, Notice } from "../../components/ui";

const categories = [
  "Quantitative Aptitude", "Logical Reasoning", "Verbal Ability",
  "Data Interpretation", "Probability", "Number Series", "Puzzles",
];

export default function AIQuestionGenerator({ onClose, onApproved, existingQuestions = [], maxQuestions = 149, initialNegativeMarks = 0 }) {
  const [settings, setSettings] = useState({
    category: categories[0], difficulty: "intermediate", count: Math.min(5, maxQuestions),
    topic: "", subtopic: "", company_exam: "", custom_prompt: "", question_format: "single",
    marks: 1, negative_marks: initialNegativeMarks, include_explanations: true, language: "English",
  });
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDrafts, setPendingDrafts] = useState([]);
  const existingTexts = new Set(existingQuestions.map((question) => question.text?.trim().replace(/\s+/g, " ").toLocaleLowerCase()).filter(Boolean));
  const selectedQuestions = draft ? selected.map((index) => draft.questions[index]).filter((question) => !existingTexts.has(question.text?.trim().replace(/\s+/g, " ").toLocaleLowerCase())) : [];
  useEffect(() => {
    listPendingDrafts().then(setPendingDrafts).catch((reason) => setError(messageFromError(reason)));
  }, []);

  async function generate(event) {
    event.preventDefault();
    const count = Number(settings.count);
    if (!Number.isInteger(count) || count < 1 || count > maxQuestions) {
      setError(`Enter a whole number from 1 to ${maxQuestions}.`);
      return;
    }
    setBusy(true);
    setError("");
    setDraft(null);
    try {
      const data = await generateDraft({
        ...settings, count, marks: Number(settings.marks), negative_marks: Number(settings.negative_marks),
      });
      setDraft(data);
      setSelected(data.questions.map((_, index) => index));
    } catch (reason) {
      setError(
        reason?.code === "ECONNABORTED" || reason?.code === "ETIMEDOUT"
          ? "Question generation is taking longer than expected. Try a smaller batch, then check saved drafts before generating again."
          : messageFromError(reason),
      );
    } finally {
      setBusy(false);
    }
  }

  function updateQuestion(index, patch) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question),
    }));
  }

  function updateOption(question, optionIndex, value) {
    const options = [...question.options];
    const previous = options[optionIndex];
    options[optionIndex] = value;
    const correct = Array.isArray(question.correct_answer)
      ? question.correct_answer.map((answer) => answer === previous ? value : answer)
      : question.correct_answer === previous ? value : question.correct_answer;
    return { options, correct_answer: correct };
  }

  async function approve() {
    if (!draft || selectedQuestions.length === 0) {
      setError("Select at least one question to approve.");
      return;
    }
    if (selectedQuestions.length > maxQuestions) {
      setError(`Only ${maxQuestions} more questions fit in this examination.`);
      return;
    }
    const selectedTexts = selectedQuestions.map((question) => question.text.trim().replace(/\s+/g, " ").toLocaleLowerCase());
    if (new Set(selectedTexts).size !== selectedTexts.length) {
      setError("Remove duplicate question text before approval.");
      return;
    }
    const invalidIndex = selectedQuestions.findIndex((question) =>
      !question.text?.trim()
      || question.options?.length !== 4
      || question.options.some((option) => !option?.trim())
      || new Set(question.options.map((option) => option.trim().toLocaleLowerCase())).size !== 4
      || typeof question.correct_answer !== "string"
      || !question.options.includes(question.correct_answer)
      || !question.explanation?.trim()
      || !Number.isFinite(Number(question.marks))
      || Number(question.marks) <= 0,
    );
    if (invalidIndex !== -1) {
      const selectedIndexes = selected.filter((index) =>
        !existingTexts.has(draft.questions[index].text?.trim().replace(/\s+/g, " ").toLocaleLowerCase()),
      );
      setError(`Question ${selectedIndexes[invalidIndex] + 1} needs four unique options, exactly one correct answer, positive marks, and a clear explanation.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const questions = selectedQuestions;
      const data = await approveDraft(draft.id, questions);
      setPendingDrafts((items) => items.filter((item) => item.id !== draft.id));
      onApproved(data.questions, Number(settings.negative_marks));
      onClose();
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="my-auto max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-lift sm:p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-brand"><Sparkles size={14} /> Groq AI question studio</div><h2 className="heading-font mt-2 text-2xl font-extrabold text-slate-900">Generate & review questions</h2><p className="mt-1 text-sm text-slate-500">Questions remain drafts until you review and approve them.</p></div>
        <button type="button" aria-label="Close question generator" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button>
      </header>
      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      {!draft && pendingDrafts.length > 0 && <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><div className="mb-2 text-sm font-bold text-slate-800">Continue reviewing saved drafts</div><div className="flex flex-wrap gap-2">{pendingDrafts.map((item) => <Button key={item.id} variant="secondary" type="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const saved = await getDraft(item.id); setDraft(saved); setSelected(saved.questions.map((_, index) => index)); } catch (reason) { setError(messageFromError(reason)); } finally { setBusy(false); } }}><span className="capitalize">{item.difficulty}</span> · {item.category} ({item.question_count})</Button>)}</div></div>}
      {!draft && <form onSubmit={generate} className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">Category<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" value={settings.category} onChange={(event) => setSettings({ ...settings, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Difficulty<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" value={settings.difficulty} onChange={(event) => setSettings({ ...settings, difficulty: event.target.value })}>{["beginner", "intermediate", "advanced"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Question type<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" value={settings.question_format} onChange={(event) => setSettings({ ...settings, question_format: event.target.value })}>{[["single", "Single-answer MCQ"], ["reasoning", "Reasoning MCQ"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Number of questions (up to {maxQuestions})<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" type="number" min="1" max={maxQuestions} required value={settings.count} onChange={(event) => setSettings({ ...settings, count: event.target.value })} /></label>
        <label className="text-sm font-semibold text-slate-700">Topic (optional)<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" maxLength="200" value={settings.topic} onChange={(event) => setSettings({ ...settings, topic: event.target.value })} placeholder="e.g. percentages and ratios" /></label>
        <label className="text-sm font-semibold text-slate-700">Subtopic (optional)<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" maxLength="200" value={settings.subtopic} onChange={(event) => setSettings({ ...settings, subtopic: event.target.value })} placeholder="e.g. compound interest" /></label>
        <label className="text-sm font-semibold text-slate-700">Exam pattern / style (optional)<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" maxLength="120" value={settings.company_exam} onChange={(event) => setSettings({ ...settings, company_exam: event.target.value })} placeholder="e.g. campus placement aptitude" /></label>
        <label className="text-sm font-semibold text-slate-700">Marks per question<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" type="number" min="0.1" max="100" step="0.1" required value={settings.marks} onChange={(event) => setSettings({ ...settings, marks: event.target.value })} /></label>
        <label className="text-sm font-semibold text-slate-700">Negative marks / wrong answer<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" type="number" min="0" max="100" step="0.25" value={settings.negative_marks} onChange={(event) => setSettings({ ...settings, negative_marks: event.target.value })} /></label>
        <label className="text-sm font-semibold text-slate-700">Language<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" minLength="2" maxLength="40" required value={settings.language} onChange={(event) => setSettings({ ...settings, language: event.target.value })} /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Your prompt / custom instructions<textarea className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal" rows={3} maxLength="2000" value={settings.custom_prompt} onChange={(event) => setSettings({ ...settings, custom_prompt: event.target.value })} placeholder="Describe exactly what to test, required concepts, constraints, or the style of questions. Generated questions will stay within this scope." /></label>
        <p className="text-xs leading-5 text-slate-500 sm:col-span-2 lg:col-span-3">Every generated question has four options, exactly one correct answer, and a clear explanation.</p>
        <div className="flex items-end sm:col-span-2 lg:col-span-3"><Button disabled={busy || maxQuestions < 1} className="w-full sm:w-auto"><Bot size={17} />{busy ? "Generating questions…" : "Generate questions"}</Button>{maxQuestions < 1 && <span className="ml-3 text-sm text-rose-600">This exam is at the 149-question limit.</span>}</div>
      </form>}
      {busy && !draft && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} />Generating original practice questions…</div>}
      {draft && <><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-brand">{draft.category}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600">{draft.difficulty}</span><span className="text-xs text-slate-400">{draft.questions.length} questions · preview, edit, then select to approve</span></div><Button variant="secondary" type="button" onClick={() => { setDraft(null); setError(""); }}>Generate another set</Button></div>
        <div className="space-y-4">{draft.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3"><input aria-label={`Select question ${index + 1}`} type="checkbox" className="h-4 w-4 accent-indigo-600" checked={selected.includes(index)} onChange={(event) => setSelected(event.target.checked ? [...selected, index] : selected.filter((item) => item !== index))} /><span className="text-xs font-bold uppercase tracking-wide text-slate-400">Question {index + 1}</span><span className="ml-auto text-xs capitalize text-slate-400">{question.difficulty} · {question.marks} marks</span></div>
          <textarea aria-label={`Question ${index + 1} text`} className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold leading-6 text-slate-800" rows={2} value={question.text} onChange={(event) => updateQuestion(index, { text: event.target.value })} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => {
            const correct = question.correct_answer === option;
            return <label key={`${index}-${optionIndex}`} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${correct ? "bg-emerald-50" : "bg-slate-50"}`}><span className="text-xs font-bold text-slate-400">{String.fromCharCode(65 + optionIndex)}</span><input aria-label={`Question ${index + 1} option ${optionIndex + 1}`} className="w-full bg-transparent text-sm outline-none" value={option} onChange={(event) => updateQuestion(index, updateOption(question, optionIndex, event.target.value))} /><input type="radio" name={`correct-${index}`} aria-label={`Mark option ${optionIndex + 1} correct`} checked={correct} onChange={() => updateQuestion(index, { correct_answer: option })} className="accent-emerald-600" /></label>;
          })}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">Difficulty<select className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal text-slate-700" value={question.difficulty} onChange={(event) => updateQuestion(index, { difficulty: event.target.value })}>{["beginner", "intermediate", "advanced"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold text-slate-500">Marks<input type="number" min="0.1" max="100" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal text-slate-700" value={question.marks} onChange={(event) => updateQuestion(index, { marks: event.target.value })} /></label></div>
          <label className="mt-3 block text-xs font-bold text-slate-500">Explanation (required)<textarea className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal leading-5 text-slate-700" rows={2} value={question.explanation} onChange={(event) => updateQuestion(index, { explanation: event.target.value })} /></label>
          <p className="mt-2 text-xs text-emerald-700">Correct answer: {question.correct_answer || "Select one option"}</p>
        </article>)}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">{selectedQuestions.length} eligible selected. Approval saves to the question bank{existingQuestions.length ? " and adds them to this exam" : ""}.</p><Button disabled={busy || selectedQuestions.length === 0} onClick={approve}>{busy ? "Saving questions…" : `Approve ${selectedQuestions.length} question${selectedQuestions.length === 1 ? "" : "s"}`}</Button></div>
      </>}
    </section>
  </div>;
}
