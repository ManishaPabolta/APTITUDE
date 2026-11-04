import { useMemo } from "react";
import { Award, BookOpenCheck, CheckCircle2, FileQuestion, Target } from "lucide-react";
import { Button, Card } from "../../components/ui";

function Metric({ Icon, title, value, note, tone }) {
  return <Card><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{title}</p><p className="heading-font mt-2 text-3xl font-extrabold text-slate-900">{value}</p></div><span className={`rounded-xl p-3 ${tone}`}><Icon size={19} /></span></div><p className="mt-4 text-xs text-slate-400">{note}</p></Card>;
}

export default function StudentDashboard({ tests = [], results = [], go, onStart }) {
  const summary = useMemo(() => ({
    available: tests.filter((test) => ["available", "upcoming", "in_progress"].includes(test.status)).length,
    average: results.length ? Math.round(results.reduce((sum, item) => sum + item.percentage, 0) / results.length) : 0,
    passed: results.filter((result) => result.passed).length,
  }), [tests, results]);
  const upcoming = tests.filter((test) => ["available", "upcoming", "in_progress"].includes(test.status)).slice(0, 3);
  return <div className="space-y-7">
    <section className="rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 p-7 text-white shadow-lg shadow-indigo-200 sm:p-9"><span className="text-xs font-bold tracking-[.18em] text-indigo-100">YOUR LEARNING JOURNEY</span><h2 className="heading-font mt-3 text-3xl font-extrabold">Small steps. Big results.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100">Every practice attempt helps you build confidence and measure progress.</p><Button variant="secondary" className="mt-5 border-0" onClick={() => go("exams")}>Explore examinations</Button></section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric Icon={FileQuestion} title="Available exams" value={summary.available} note="Assigned assessments" tone="bg-indigo-50 text-brand" /><Metric Icon={CheckCircle2} title="Completed" value={results.length} note="Total finished attempts" tone="bg-emerald-50 text-emerald-600" /><Metric Icon={Target} title="Average score" value={`${summary.average}%`} note="Across all completed exams" tone="bg-amber-50 text-amber-600" /><Metric Icon={Award} title="Passed exams" value={summary.passed} note="Keep up your momentum" tone="bg-rose-50 text-rose-600" /></div>
    <Card><div className="mb-5 flex items-center justify-between"><div><h2 className="heading-font font-extrabold text-slate-900">Your next examinations</h2><p className="mt-1 text-sm text-slate-500">Pick up where you left off.</p></div><button onClick={() => go("exams")} className="text-sm font-bold text-brand">View all</button></div>
      {upcoming.length ? <div className="grid gap-3 md:grid-cols-3">{upcoming.map((test) => <article key={test.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center gap-2 text-xs font-semibold capitalize text-brand"><BookOpenCheck size={15} />{test.status?.replace("_", " ")}</div><h3 className="mt-3 font-bold text-slate-800">{test.title}</h3><p className="mt-1 text-xs text-slate-500">{test.duration_minutes} min · {test.question_count} questions</p>{test.status !== "upcoming" && <Button className="mt-4 w-full" onClick={() => onStart(test)}>{test.status === "in_progress" ? "Resume" : "Start"} examination</Button>}</article>)}</div> : <p className="py-12 text-center text-sm text-slate-400">New assigned examinations will appear here.</p>}
    </Card>
  </div>;
}
