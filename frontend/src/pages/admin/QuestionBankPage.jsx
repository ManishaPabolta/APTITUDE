import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Download, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { createBankQuestion, deleteBankQuestion, downloadQuestionBank, listQuestionBank, updateBankQuestion } from "../../api/questionBank";
import { resolveMediaUrl, uploadQuestionImage } from "../../api/media";
import { Badge, Button, Card, Notice, Spinner } from "../../components/ui";
import AIQuestionGenerator from "./AIQuestionGenerator";

const categories = [
  "Quantitative Aptitude", "Logical Reasoning", "Verbal Ability", "Data Interpretation",
  "Probability", "Number Series", "Puzzles",
];
const emptyQuestion = {
  text: "",
  type: "single",
  category: categories[0],
  topic: "",
  section: "General",
  tags: "",
  image_url: "",
  math_expression: "",
  difficulty: "intermediate",
  options: ["", "", "", ""],
  correct_answer: "",
  marks: 1,
  explanation: "",
};

function QuestionEditor({ question, onClose, onSaved }) {
  const imageFile = useRef(null);
  const [form, setForm] = useState(() => question ? {
    ...question,
    tags: question.tags?.join(", ") || "",
    options: question.options?.length ? [...question.options] : ["", "", "", ""],
    correct_answer: Array.isArray(question.correct_answer) ? [...question.correct_answer] : [question.correct_answer],
  } : { ...emptyQuestion, options: [...emptyQuestion.options], correct_answer: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const isChoice = ["single", "multiple", "reasoning"].includes(form.type);

  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadImage(file) {
    if (!file) return;
    setUploadingImage(true);
    try { change("image_url", await uploadQuestionImage(file)); }
    catch (reason) { setError(reason?.response?.data?.detail || reason.message || "Unable to upload this image."); }
    finally { setUploadingImage(false); imageFile.current.value = ""; }
  }

  function changeType(type) {
    setForm((current) => ({
      ...current,
      type,
      options: ["single", "multiple", "reasoning"].includes(type) ? (current.options.length ? current.options : ["", "", "", ""]) : [],
      correct_answer: type === "multiple" ? (Array.isArray(current.correct_answer) ? current.correct_answer : []) : (Array.isArray(current.correct_answer) ? current.correct_answer[0] || "" : current.correct_answer),
    }));
  }

  function toggleCorrectAnswer(option) {
    if (form.type === "multiple") {
      const current = Array.isArray(form.correct_answer) ? form.correct_answer : [];
      change("correct_answer", current.includes(option) ? current.filter((value) => value !== option) : [...current, option]);
    } else {
      change("correct_answer", option);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const options = isChoice ? form.options.map((option) => option.trim()).filter(Boolean) : [];
    const payload = {
      ...form,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      image_url: form.image_url.trim() || null,
      options,
      correct_answer: form.type === "multiple"
        ? form.correct_answer
        : form.type === "numerical" ? String(form.correct_answer).trim() : form.correct_answer,
      marks: Number(form.marks),
    };
    try {
      if (question) await updateBankQuestion(question.id, payload);
      else await createBankQuestion(payload);
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason?.response?.data?.detail || reason.message || "Unable to save this question.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="question-editor-title">
    <form onSubmit={submit} className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lift">
      <div className="mb-5 flex items-center justify-between gap-3"><div><h2 id="question-editor-title" className="heading-font text-xl font-extrabold text-slate-900">{question ? "Edit question" : "Add question"}</h2><p className="mt-1 text-sm text-slate-500">Saved questions are available to add to future examinations.</p></div><button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Question text<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal outline-none focus:border-brand" required maxLength={5000} value={form.text} onChange={(event) => change("text", event.target.value)} /></label>
        <label className="text-sm font-semibold text-slate-700">Type<select className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" value={form.type} onChange={(event) => changeType(event.target.value)}><option value="single">Single answer</option><option value="multiple">Multiple answers</option><option value="numerical">Numerical</option><option value="reasoning">Reasoning</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Category<select className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" value={form.category} onChange={(event) => change("category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Difficulty<select className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal capitalize" value={form.difficulty} onChange={(event) => change("difficulty", event.target.value)}>{["beginner", "intermediate", "advanced"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Marks<input className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" type="number" min="0.01" max="100" step="0.25" required value={form.marks} onChange={(event) => change("marks", event.target.value)} /></label>
        <label className="text-sm font-semibold text-slate-700">Topic<input className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" maxLength={120} value={form.topic || ""} onChange={(event) => change("topic", event.target.value)} /></label>
        <label className="text-sm font-semibold text-slate-700">Section<input className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" maxLength={120} value={form.section || "General"} onChange={(event) => change("section", event.target.value)} /></label>
        <label className="text-sm font-semibold text-slate-700">Tags <span className="font-normal text-slate-400">(comma-separated)</span><input className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" placeholder="percentages, ratios" value={form.tags || ""} onChange={(event) => change("tags", event.target.value)} /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Diagram image URL <span className="font-normal text-slate-400">(HTTPS or upload)</span><input className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" value={form.image_url || ""} onChange={(event) => change("image_url", event.target.value)} /></label>
        <div className="sm:col-span-2"><input ref={imageFile} hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => uploadImage(event.target.files?.[0])} /><Button type="button" variant="secondary" disabled={uploadingImage} onClick={() => imageFile.current?.click()}>{uploadingImage ? "Uploading image…" : "Upload question image (max 5 MB)"}</Button></div>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Math expression<textarea className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-mono font-normal" maxLength={1000} value={form.math_expression || ""} onChange={(event) => change("math_expression", event.target.value)} /></label>
      </div>
      {isChoice && <div className="mt-5"><div className="mb-2 text-sm font-semibold text-slate-700">Answer options <span className="font-normal text-slate-400">— choose {form.type === "multiple" ? "all correct answers" : "the correct answer"}</span></div><div className="space-y-2">
        {form.options.map((option, index) => <div key={index} className="flex items-center gap-3"><input aria-label={`Mark option ${index + 1} as correct`} type={form.type === "multiple" ? "checkbox" : "radio"} name="correct-answer" className="h-4 w-4 accent-indigo-600" disabled={!option.trim()} checked={Array.isArray(form.correct_answer) ? form.correct_answer.includes(option) : form.correct_answer === option} onChange={() => toggleCorrectAnswer(option)} /><input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand" placeholder={`Option ${index + 1}`} required value={option} onChange={(event) => {
          const updated = [...form.options];
          const previous = updated[index];
          updated[index] = event.target.value;
          setForm((current) => ({ ...current, options: updated, correct_answer: Array.isArray(current.correct_answer) ? current.correct_answer.map((answer) => answer === previous ? event.target.value : answer) : current.correct_answer === previous ? event.target.value : current.correct_answer }));
        }} /></div>)}
      </div></div>}
      {!isChoice && <label className="mt-5 block text-sm font-semibold text-slate-700">Correct numerical answer<input className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" type="number" step="any" required value={Array.isArray(form.correct_answer) ? form.correct_answer[0] || "" : form.correct_answer} onChange={(event) => change("correct_answer", event.target.value)} /></label>}
      <label className="mt-5 block text-sm font-semibold text-slate-700">Explanation<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal outline-none focus:border-brand" maxLength={5000} value={form.explanation || ""} onChange={(event) => change("explanation", event.target.value)} /></label>
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : question ? "Save changes" : "Add to question bank"}</Button></div>
    </form>
  </div>;
}

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [tag, setTag] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [editor, setEditor] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await listQuestionBank({ search: search || undefined, category: category || undefined, difficulty: difficulty || undefined, tag: tag || undefined, offset, limit: 25 });
      setQuestions(result.items);
      setTotal(result.total);
      setError("");
    } catch (reason) {
      setError(reason?.response?.data?.detail || reason.message || "Unable to load the question bank.");
    } finally {
      setLoading(false);
    }
  }, [category, difficulty, offset, search, tag]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 200);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function remove(question) {
    if (!window.confirm("Delete this question from the bank? Existing examinations will not be changed.")) return;
    try {
      await deleteBankQuestion(question.id);
      await refresh();
    } catch (reason) {
      setError(reason?.response?.data?.detail || reason.message || "Unable to delete this question.");
    }
  }

  async function exportQuestions() {
    try {
      const file = await downloadQuestionBank();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "question-bank.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason?.response?.data?.detail || reason.message || "Unable to export questions.");
    }
  }

  return <div>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="heading-font text-xl font-extrabold text-slate-900">Question bank</h1><p className="mt-1 text-sm text-slate-500">Review and manage approved AI-generated and manually authored questions.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={exportQuestions}><Download size={16} /> Export CSV</Button><Button variant="secondary" onClick={() => setAiOpen(true)}><Sparkles size={16} /> Generate with AI</Button><Button onClick={() => setEditor({ ...emptyQuestion, options: [...emptyQuestion.options], correct_answer: [] })}><Plus size={16} /> Add question</Button></div></div>
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}
    <Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand" placeholder="Search question text…" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} /></label><select aria-label="Filter by category" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0); }}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by difficulty" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setOffset(0); }}><option value="">All difficulties</option>{["beginner", "intermediate", "advanced"].map((item) => <option key={item}>{item}</option>)}</select><input aria-label="Filter by tag" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Tag" value={tag} onChange={(event) => { setTag(event.target.value); setOffset(0); }} /></div>
      {loading ? <Spinner /> : questions.length ? <div className="space-y-3">{questions.map((question) => <article key={question.id} className="rounded-xl border border-slate-100 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><Badge tone="blue">{question.category}</Badge><Badge>{question.difficulty}</Badge><Badge>{question.marks} marks</Badge><Badge>{question.usage_count || 0} uses</Badge><Badge tone={question.source === "groq" ? "green" : "slate"}>{question.source === "groq" ? "AI approved" : "Manual"}</Badge>{(question.tags || []).map((tag) => <Badge key={tag}>{tag}</Badge>)}</div><h2 className="font-semibold text-slate-800">{question.text}</h2>{question.topic && <p className="mt-1 text-xs text-slate-500">Topic: {question.topic}</p>}{question.image_url && <img src={resolveMediaUrl(question.image_url)} alt="Question diagram" className="mt-3 max-h-56 rounded-lg border border-slate-200 object-contain" loading="lazy" />}{question.math_expression && <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-sm">{question.math_expression}</pre>}</div><div className="flex gap-1"><button aria-label="Edit question" onClick={() => setEditor(question)} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-brand"><Pencil size={16} /></button><button aria-label="Delete question" onClick={() => remove(question)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></div></div>
        {question.options?.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <div key={option} className={`rounded-lg px-3 py-2 text-sm ${Array.isArray(question.correct_answer) ? question.correct_answer.includes(option) : question.correct_answer === option ? "bg-emerald-50 font-medium text-emerald-800" : "bg-slate-50 text-slate-600"}`}>{option}</div>)}</div>}
        {question.type === "numerical" && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Correct answer: {question.correct_answer}</div>}
        {question.explanation && <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500"><span className="font-semibold text-slate-700">Explanation: </span>{question.explanation}</p>}
      </article>)}</div> : <div className="py-12 text-center"><BookOpen className="mx-auto text-slate-300" size={28} /><p className="mt-3 font-semibold text-slate-700">No questions found</p><p className="mt-1 text-sm text-slate-500">Add a question or approve a question set generated by AI.</p></div>}
      {!loading && <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>{total} question{total === 1 ? "" : "s"} total</span><div className="flex items-center gap-3"><Button className="px-3 py-1.5 text-xs" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><span>{total ? offset + 1 : 0}–{Math.min(offset + questions.length, total)}</span><Button className="px-3 py-1.5 text-xs" variant="secondary" disabled={offset + 25 >= total} onClick={() => setOffset(offset + 25)}>Next</Button></div></div>}
    </Card>
    {editor && <QuestionEditor question={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={refresh} />}
    {aiOpen && <AIQuestionGenerator maxQuestions={149} existingQuestions={questions} onClose={() => setAiOpen(false)} onApproved={() => { setOffset(0); refresh(); }} />}
  </div>;
}
