import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { listQuestionBank } from "../../api/questionBank";
import { resolveMediaUrl } from "../../api/media";
import { Badge, Button, Notice, Spinner } from "../../components/ui";

const categories = [
  "Quantitative Aptitude", "Logical Reasoning", "Verbal Ability", "Data Interpretation",
  "Probability", "Number Series", "Puzzles",
];

export default function QuestionBankPicker({ onClose, onAdd, maxQuestions = 149, existingQuestions = [] }) {
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [tag, setTag] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 50;
  const existingTexts = new Set(existingQuestions.map((question) => question.text?.trim().replace(/\s+/g, " ").toLocaleLowerCase()).filter(Boolean));
  const existingBankIds = new Set(existingQuestions.map((question) => question.bank_question_id).filter(Boolean));

  useEffect(() => {
    let active = true;
    setLoading(true);
    listQuestionBank({ search: search || undefined, category: category || undefined, difficulty: difficulty || undefined, tag: tag || undefined, offset, limit: pageSize })
      .then((result) => { if (active) { setQuestions(result.items); setTotal(result.total); setError(""); } })
      .catch((reason) => { if (active) setError(reason?.response?.data?.detail || reason.message || "Unable to load questions."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, difficulty, offset, search, tag]);

  function toggle(question) {
    setSelected((current) => {
      if (current.some((item) => item.id === question.id)) return current.filter((item) => item.id !== question.id);
      if (current.length >= maxQuestions) return current;
      return [...current, question];
    });
  }

  function addSelected() {
    onAdd(selected.map(({
      id: bank_question_id, text, type, category: questionCategory, section, topic,
      tags, difficulty, image_url, math_expression, options, correct_answer, marks, explanation,
    }) => ({
      bank_question_id, text, type, category: questionCategory, section, topic, tags,
      difficulty, image_url, math_expression, options, correct_answer, marks, explanation,
    })));
  }

  return <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="question-picker-title">
    <section className="my-auto flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 shadow-lift sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="question-picker-title" className="heading-font text-xl font-extrabold text-slate-900">Add from question bank</h2><p className="mt-1 text-sm text-slate-500">Choose approved questions to copy into this examination.</p></div><button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand" placeholder="Search question text…" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} /></label><select aria-label="Filter by category" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0); }}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by difficulty" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setOffset(0); }}><option value="">All difficulties</option>{["beginner", "intermediate", "advanced"].map((item) => <option key={item}>{item}</option>)}</select><input aria-label="Filter by tag" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Tag" value={tag} onChange={(event) => { setTag(event.target.value); setOffset(0); }} /></div>
      {error && <div className="mb-3"><Notice>{error}</Notice></div>}
      <div className="min-h-32 flex-1 overflow-y-auto">
        {loading ? <Spinner /> : questions.length ? <div className="space-y-2">{questions.map((question) => {
          const checked = selected.some((item) => item.id === question.id);
          const alreadyAdded = existingBankIds.has(question.id) || existingTexts.has(question.text?.trim().replace(/\s+/g, " ").toLocaleLowerCase());
          const atLimit = !checked && selected.length >= maxQuestions;
          return <label key={question.id} className={`flex gap-3 rounded-xl border p-3 transition ${checked ? "border-indigo-300 bg-indigo-50/60" : alreadyAdded || atLimit ? "cursor-not-allowed border-slate-100 opacity-60" : "cursor-pointer border-slate-100 hover:border-slate-200"}`}>
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-indigo-600" checked={checked} disabled={alreadyAdded || atLimit} onChange={() => toggle(question)} />
            <span className="min-w-0 flex-1"><span className="mb-1.5 flex flex-wrap gap-1.5"><Badge tone="blue">{question.category}</Badge><Badge>{question.difficulty}</Badge><Badge>{question.marks} marks</Badge>{alreadyAdded && <Badge tone="amber">Already in exam</Badge>}{(question.tags || []).map((tag) => <Badge key={tag}>{tag}</Badge>)}</span><span className="block text-sm font-medium text-slate-800">{question.text}</span>{question.image_url && <img src={resolveMediaUrl(question.image_url)} alt="Question diagram" className="mt-2 max-h-36 rounded-lg border border-slate-200 object-contain" loading="lazy" />}</span>
          </label>;
        })}</div> : <div className="py-10 text-center text-sm text-slate-500">No approved questions match these filters.</div>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-sm text-slate-500">{selected.length}/{maxQuestions} selected · {total} questions available</span><div className="flex items-center gap-3"><Button type="button" className="px-3 py-1.5 text-xs" variant="secondary" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</Button><span className="text-xs text-slate-500">{total ? offset + 1 : 0}–{Math.min(offset + questions.length, total)}</span><Button type="button" className="px-3 py-1.5 text-xs" variant="secondary" disabled={offset + pageSize >= total || loading} onClick={() => setOffset(offset + pageSize)}>Next</Button><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!selected.length} onClick={addSelected}>Add selected</Button></div></div>
    </section>
  </div>;
}
