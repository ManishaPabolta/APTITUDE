import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ShieldCheck,
} from "lucide-react";
import api, { messageFromError } from "../../api";
import { resolveMediaUrl } from "../../api/media";
import { Badge, Button, Card, Notice, Spinner } from "../../components/ui";

const cx = (...values) => values.filter(Boolean).join(" ");

export default function ExamRoom({ test, sessionId, onExit }) {
  const [exam, setExam] = useState(null);
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [sectionSeconds, setSectionSeconds] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [started, setStarted] = useState(Boolean(sessionId));
  const [accessCode, setAccessCode] = useState("");
  const [violationCount, setViolationCount] = useState(0);
  const [violationNotice, setViolationNotice] = useState("");
  const reportingViolation = useRef(false);
  const saveTimer = useRef(null);
  const pendingAnswers = useRef(new Map());
  const saveQueue = useRef(Promise.resolve());
  const initialized = useRef(false);
  const advancingSection = useRef(false);

  const loadExam = useCallback(async () => {
    if (!sessionId) return;
    const response = await api.get(`/student/sessions/${sessionId}`);
    setExam(response.data);
    setSeconds(response.data.remaining_seconds);
    setSectionSeconds(response.data.section_remaining_seconds ?? null);
    const firstSectionQuestion = response.data.questions.findIndex((item) => item.section === response.data.section);
    if (firstSectionQuestion >= 0) setCurrent(firstSectionQuestion);
    setViolationCount(response.data.violation_count || 0);
  }, [sessionId, test?.id]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadExam().catch((err) => setError(messageFromError(err)));
  }, [loadExam]);

  const flushAnswers = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    const pending = [...pendingAnswers.current.entries()];
    pendingAnswers.current.clear();
    if (!pending.length) return saveQueue.current;
    const operation = saveQueue.current.then(async () => {
      const saved = await Promise.allSettled(pending.map(([questionId, payload]) =>
        api.put(`/student/sessions/${exam.session_id}/answers/${questionId}`, payload),
      ));
      const failed = saved.flatMap((item, index) => item.status === "rejected" ? [index] : []);
      for (const index of failed) pendingAnswers.current.set(pending[index][0], pending[index][1]);
      if (failed.length) throw saved[failed[0]].reason;
    });
    saveQueue.current = operation.catch((reason) => {
      saveQueue.current = Promise.resolve();
      throw reason;
    });
    return saveQueue.current;
  }, [exam?.session_id]);

  const submit = useCallback(async (reason = "student_submitted") => {
    if (!exam?.session_id || busy || result) return;
    if (reason === "student_submitted" && !window.confirm("Submit your examination now? You cannot make changes afterwards.")) return;
    setBusy(true);
    try {
      await flushAnswers();
      const response = await api.post(`/student/sessions/${exam.session_id}/submit`, { reason });
      setResult(response.data);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }, [exam?.session_id, busy, result, flushAnswers]);

  const advanceSection = useCallback(async () => {
    if (!exam?.session_id || result || advancingSection.current) return;
    advancingSection.current = true;
    try {
      await flushAnswers();
      const { data } = await api.post(`/student/sessions/${exam.session_id}/section/advance`);
      if (data.submitted) {
        setResult(data.result);
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        return;
      }
      setExam(data);
      setSeconds(data.remaining_seconds);
      setSectionSeconds(data.section_remaining_seconds ?? null);
      const firstIndex = data.questions.findIndex((item) => item.section === data.section);
      if (firstIndex >= 0) setCurrent(firstIndex);
      setError("");
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      advancingSection.current = false;
    }
  }, [exam?.session_id, result, flushAnswers]);

  const reportViolation = useCallback(async (event_type, details = "") => {
    if (reportingViolation.current || !exam?.session_id || result) return;
    reportingViolation.current = true;
    try {
      await flushAnswers();
      const { data } = await api.post(`/student/sessions/${exam.session_id}/activity`, { event_type, details });
      setViolationCount(data.violation_count ?? violationCount);
      setViolationNotice(data.submitted
        ? `Exam automatically submitted after detected violation: ${event_type.replaceAll("_", " ")}.`
        : `${event_type.replaceAll("_", " ")} was detected and recorded.`);
      if (data.submitted && data.result) {
        setResult(data.result);
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      }
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      reportingViolation.current = false;
    }
  }, [exam?.session_id, result, flushAnswers, violationCount]);

  const startExam = useCallback(async () => {
    setBusy(true);
    try {
      await document.documentElement.requestFullscreen();
      setFullscreen(true);
      const payload = accessCode.trim() ? { access_code: accessCode.trim() } : undefined;
      const response = await api.post(`/student/tests/${test.id}/start`, payload);
      setExam(response.data);
      setSeconds(response.data.remaining_seconds);
      setSectionSeconds(response.data.section_remaining_seconds ?? null);
      setViolationCount(response.data.violation_count || 0);
      setStarted(true);
      setError("");
    } catch (err) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setFullscreen(false);
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }, [accessCode, test?.id]);

  useEffect(() => {
    if (!exam || result) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") reportViolation("visibility_change", "Browser tab became hidden");
    };
    const onBlur = () => reportViolation("window_blur", "Exam window lost focus");
    const onFullscreen = () => {
      if (fullscreen && !document.fullscreenElement) reportViolation("fullscreen_exit", "Fullscreen mode was exited");
    };
    const onBlock = (event) => {
      event.preventDefault();
      const type = event.type === "contextmenu" ? "context_menu" : event.type;
      reportViolation(type, "Restricted browser action");
    };
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onBlock);
    document.addEventListener("paste", onBlock);
    document.addEventListener("cut", onBlock);
    document.addEventListener("contextmenu", onBlock);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onBlock);
      document.removeEventListener("paste", onBlock);
      document.removeEventListener("cut", onBlock);
      document.removeEventListener("contextmenu", onBlock);
      window.removeEventListener("blur", onBlur);
    };
  }, [exam, fullscreen, reportViolation, result]);

  useEffect(() => {
    if (!exam || result) return undefined;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          submit("time_expired");
          return 0;
        }
        return value - 1;
      });
      if (sectionSeconds !== null) {
        setSectionSeconds((value) => {
          if (value === null) return null;
          if (value <= 1) {
            window.clearInterval(timer);
            advanceSection();
            return 0;
          }
          return value - 1;
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exam, result, submit, sectionSeconds, advanceSection]);

  function answer(question, nextAnswer, marked) {
    const next = {
      answer: nextAnswer,
      marked_for_review: marked ?? exam.answers?.[question.id]?.marked_for_review ?? false,
    };
    setExam((currentExam) => ({
      ...currentExam,
      answers: { ...currentExam.answers, [question.id]: next },
    }));
    pendingAnswers.current.set(question.id, next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => flushAnswers().catch((err) => setError(messageFromError(err))),
      350,
    );
  }

  const question = exam?.questions?.[current];
  const sectionIndices = exam?.section
    ? exam.questions.map((item, index) => item.section === exam.section ? index : -1).filter((index) => index >= 0)
    : exam?.questions?.map((_, index) => index) || [];
  const currentSectionPosition = sectionIndices.indexOf(current);
  const response = question ? exam.answers?.[question.id] || { answer: null, marked_for_review: false } : null;
  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const answeredCount = exam?.questions?.filter((item) => {
    const value = exam.answers?.[item.id]?.answer;
    return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
  }).length || 0;

  async function requestFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreen(true);
    } catch {
      setError("Fullscreen could not be enabled. Please allow fullscreen to continue.");
    }
  }

  if (result) return <div className="min-h-screen bg-canvas p-5"><div className="mx-auto max-w-2xl pt-12"><Card className="text-center sm:p-10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={34} /></div><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-brand">Examination complete</p><h1 className="heading-font mt-2 text-3xl font-extrabold">{result.test_title}</h1><p className="mt-2 text-sm text-slate-500">{result.submission_reason?.startsWith("anti_cheat") ? "Your exam was submitted due to an examination integrity event." : "Your answers have been submitted and evaluated."}</p>{result.result_hidden ? <div className="my-8 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">Your submission is recorded. The exam administrator has configured results to be released later or kept private.</div> : <><div className="my-8 grid grid-cols-3 gap-3"><div className="rounded-2xl bg-indigo-50 p-4"><strong className="heading-font block text-2xl text-brand">{result.score}/{result.total_marks}</strong><span className="mt-1 block text-xs text-slate-500">Score</span></div><div className="rounded-2xl bg-emerald-50 p-4"><strong className="heading-font block text-2xl text-emerald-600">{result.percentage}%</strong><span className="mt-1 block text-xs text-slate-500">Percentage</span></div><div className="rounded-2xl bg-amber-50 p-4"><strong className="heading-font block text-2xl text-amber-600">{result.correct_count}/{result.question_count}</strong><span className="mt-1 block text-xs text-slate-500">Correct</span></div></div><Badge tone={result.passed ? "green" : "amber"}>{result.passed ? "Passed" : "Keep practicing"}</Badge></>}<div className="mt-7"><Button onClick={onExit}>Back to my dashboard <ArrowRight size={16} /></Button></div></Card></div></div>;
  if (error && !exam) return <div className="grid min-h-screen place-items-center bg-canvas p-5"><Card className="max-w-lg"><Notice>{error}</Notice><Button className="mt-5" variant="secondary" onClick={onExit}>Return to dashboard</Button></Card></div>;
  if (!started) return <div className="min-h-screen bg-canvas p-5"><div className="mx-auto max-w-3xl pt-8"><Card><div className="flex items-start gap-4"><div className="rounded-xl bg-indigo-50 p-3 text-brand"><ShieldCheck size={23} /></div><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand">Before you begin</p><h1 className="heading-font mt-1 text-2xl font-extrabold text-slate-900">{test.title}</h1><p className="mt-2 text-sm text-slate-500">{test.description || "Review the exam details and instructions before starting."}</p></div></div>
    <div className="my-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4 text-sm"><b>{test.duration_minutes} minutes</b><div className="mt-1 text-xs text-slate-500">Server-timed duration</div></div><div className="rounded-xl bg-slate-50 p-4 text-sm"><b>{test.question_count} questions</b><div className="mt-1 text-xs text-slate-500">{test.allowed_attempts || 1} allowed attempt(s)</div></div><div className="rounded-xl bg-slate-50 p-4 text-sm"><b>{test.has_access_code ? "Access code required" : "No access code"}</b><div className="mt-1 text-xs text-slate-500">Answers autosave to the server</div></div></div>
    {Object.keys(test.section_time_limits || {}).length > 0 && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-bold text-amber-900">Timed sections</h2><ul className="mt-2 flex flex-wrap gap-2 text-sm text-amber-800">{Object.entries(test.section_time_limits).map(([section, minutes]) => <li key={section} className="rounded-lg bg-white/70 px-3 py-1.5">{section}: {minutes} minutes</li>)}</ul><p className="mt-2 text-xs text-amber-800">Sections are completed in order. You cannot return to a previous section.</p></div>}
    {test.instructions && <div className="mb-5 rounded-xl border border-slate-200 p-4"><h2 className="font-bold text-slate-800">Exam instructions</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{test.instructions}</p></div>}
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><b>Integrity notice:</b> browser monitoring records detected events and may submit the exam according to its configured policy. Browser controls cannot detect every form of cheating or prevent use of another device.</div>
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}
    {test.has_access_code && <label className="block text-sm font-semibold text-slate-700">Examination access code<input className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal outline-none focus:border-brand" type="password" autoComplete="off" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} /></label>}
    <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={onExit}>Cancel</Button><Button disabled={busy} onClick={startExam}>{busy ? "Starting…" : "Agree & start examination"}<ArrowRight size={16} /></Button></div></Card></div></div>;
  if (!exam || !question) return <div className="grid min-h-screen place-items-center bg-canvas"><Spinner /></div>;

  return <div className="exam-safe min-h-screen select-none bg-[#f7f8fc] text-slate-800" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onPaste={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
    <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:min-h-[72px] sm:px-8"><div className="flex min-w-0 items-center gap-2 sm:gap-3"><div className="shrink-0 rounded-xl bg-indigo-50 p-2 text-brand"><ShieldCheck size={20} /></div><div className="min-w-0"><h1 className="heading-font truncate text-sm font-extrabold sm:text-base">{test.title}</h1><div className="truncate text-[11px] text-slate-400">{exam.section ? `${exam.section} · Section ${exam.section_index + 1}/${exam.section_count}` : "Secure examination session"}</div></div></div><div className="flex shrink-0 items-center gap-2 sm:gap-3"><span className="hidden text-xs font-medium text-slate-400 sm:inline">TIME REMAINING</span><div className={cx("flex items-center gap-1.5 rounded-xl px-2 py-2 font-mono text-base font-bold sm:gap-2 sm:px-3 sm:text-lg", seconds < 300 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-700")}><Clock3 size={16} />{formattedTime}</div>{sectionSeconds !== null && <div className="hidden rounded-xl bg-amber-50 px-3 py-2 font-mono text-sm font-bold text-amber-700 sm:block">Section {String(Math.floor(sectionSeconds / 60)).padStart(2, "0")}:{String(sectionSeconds % 60).padStart(2, "0")}</div>}</div></header>
    <main className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-7 lg:grid-cols-[1fr_290px]">
      <section><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><Badge tone="blue">{question.type === "single" ? "Single answer" : question.type === "multiple" ? "Select all that apply" : question.type}</Badge><span className="ml-2 text-xs text-slate-400">{question.marks} marks</span></div><div className="text-xs text-slate-500">Question {current + 1} of {exam.questions.length}</div></div>
        {error && <div className="mb-4"><Notice onClose={() => setError("")}>{error}</Notice></div>}
        {violationNotice && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">Violation {violationCount}/{exam.violation_limit || test.violation_limit || 1}: {violationNotice}</div>}
        <Card className="min-h-[350px] sm:p-8"><div className="flex items-start justify-between gap-3"><div className="heading-font max-w-3xl text-xl font-bold leading-relaxed text-slate-900 sm:text-2xl">{question.text}{question.image_url && <img src={resolveMediaUrl(question.image_url)} alt="Question diagram" className="mt-4 max-h-80 rounded-xl border border-slate-200 object-contain" />}{question.math_expression && <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-4 text-base font-mono">{question.math_expression}</pre>}</div><button onClick={() => answer(question, response.answer, !response.marked_for_review)} className={cx("shrink-0 rounded-xl px-3 py-2 text-xs font-bold", response.marked_for_review ? "bg-amber-100 text-amber-700" : "bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-700")}>{response.marked_for_review ? "Marked" : "Mark for review"}</button></div>
          {["single", "reasoning"].includes(question.type) && <div className="mt-8 space-y-3">{question.options.map((option, index) => <button key={index} onClick={() => answer(question, option)} className={cx("flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition", response.answer === option ? "border-brand bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50")}><span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold", response.answer === option ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-500")}>{String.fromCharCode(65 + index)}</span><span className="text-sm font-medium">{option}</span>{response.answer === option && <Check size={17} className="ml-auto text-brand" />}</button>)}</div>}
          {question.type === "multiple" && <div className="mt-8 space-y-3">{question.options.map((option, index) => { const selected = Array.isArray(response.answer) && response.answer.includes(option); return <button key={index} onClick={() => { const values = Array.isArray(response.answer) ? response.answer : []; answer(question, selected ? values.filter((value) => value !== option) : [...values, option]); }} className={cx("flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition", selected ? "border-brand bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50")}><span className={cx("flex h-6 w-6 items-center justify-center rounded-md border", selected ? "border-brand bg-brand text-white" : "border-slate-300")}>{selected && <Check size={14} />}</span><span className="text-sm font-medium">{option}</span></button>; })}</div>}
          {question.type === "numerical" && <label className="mt-8 block max-w-sm text-sm font-semibold text-slate-700">Your numerical answer<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-indigo-100" type="number" step="any" value={response.answer ?? ""} onChange={(event) => answer(question, event.target.value)} placeholder="Enter your answer" /></label>}
        </Card>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><Button variant="secondary" disabled={currentSectionPosition <= 0} onClick={() => setCurrent(sectionIndices[currentSectionPosition - 1])}><ChevronLeft size={17} /> Previous</Button><div className="flex gap-2"><Button variant="secondary" onClick={() => { answer(question, null, false); if (currentSectionPosition < sectionIndices.length - 1) setCurrent(sectionIndices[currentSectionPosition + 1]); }}>Clear answer</Button>{exam.section && exam.section_index < exam.section_count - 1 && <Button variant="secondary" disabled={busy} onClick={advanceSection}>Next section <ChevronRight size={16} /></Button>}<Button onClick={() => currentSectionPosition === sectionIndices.length - 1 ? (exam.section && exam.section_index < exam.section_count - 1 ? advanceSection() : submit()) : setCurrent(sectionIndices[currentSectionPosition + 1])}>{currentSectionPosition === sectionIndices.length - 1 ? (exam.section && exam.section_index < exam.section_count - 1 ? "Continue section" : "Review & submit") : "Save & next"} <ChevronRight size={16} /></Button></div></div>
      </section>
      <aside className="space-y-5"><Card><div className="flex items-center justify-between"><h2 className="font-bold">Question navigator</h2><span className="text-xs text-slate-400">{answeredCount}/{exam.questions.length} answered</span></div><div className="mt-5 grid grid-cols-5 gap-2">{exam.questions.map((item, index) => { const value = exam.answers?.[item.id]?.answer; const answered = value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length); const marked = exam.answers?.[item.id]?.marked_for_review; const sectionLocked = exam.section && item.section !== exam.section; return <button key={item.id} disabled={sectionLocked} title={sectionLocked ? "This question is in another timed section" : ""} onClick={() => setCurrent(index)} className={cx("relative flex h-10 items-center justify-center rounded-xl text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-30", current === index ? "bg-brand text-white ring-4 ring-indigo-100" : marked ? "bg-amber-100 text-amber-700" : answered ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>{index + 1}</button>; })}</div><div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded bg-emerald-400" />Answered</div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded bg-amber-400" />Marked for review</div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded bg-slate-300" />Not answered</div></div></Card>
        <Card className="border-indigo-100 bg-indigo-50/60"><div className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 text-brand" /><div><h3 className="text-sm font-bold text-slate-800">Integrity monitoring</h3><p className="mt-1 text-xs leading-5 text-slate-500">Violations are logged and counted ({violationCount}/{exam.violation_limit || test.violation_limit || 1}). The configured policy may submit your exam automatically. Answers save as you go.</p></div></div>{!fullscreen && <Button variant="secondary" className="mt-4 w-full border-indigo-100 text-xs" onClick={requestFullscreen}>Enter fullscreen</Button>}</Card>
        <Card><h3 className="text-sm font-bold">Ready to finish?</h3><p className="mt-1 text-xs leading-5 text-slate-500">You can review unanswered questions before submitting. Submission cannot be undone.</p><Button variant="secondary" className="mt-4 w-full" disabled={busy} onClick={() => submit()}>{busy ? "Submitting…" : "Submit examination"} <ArrowRight size={15} /></Button></Card>
      </aside>
    </main>
  </div>;
}
