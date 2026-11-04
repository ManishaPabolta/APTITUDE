import { Activity, Award, FileQuestion, GraduationCap, Plus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, Notice } from "../../components/ui";

function Metric({ Icon, title, value, caption, color }) {
  return <Card><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{title}</p><p className="heading-font mt-2 text-3xl font-extrabold text-slate-900">{value ?? "—"}</p></div><div className={`rounded-xl p-3 ${color}`}><Icon size={20} /></div></div><p className="mt-4 text-xs text-slate-400">{caption}</p></Card>;
}

export default function AdminDashboard({ overview, go, onRefresh }) {
  if (!overview) {
    return <Card className="mx-auto max-w-xl">
      <Notice>Dashboard statistics could not be loaded. Check the message above and try again.</Notice>
      <Button className="mt-4" variant="secondary" onClick={onRefresh}>Retry loading dashboard</Button>
    </Card>;
  }

  const scores = [
    { label: "Average score", value: overview.average_percentage || 0 },
    { label: "Pass rate", value: overview.pass_rate || 0 },
  ];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><p className="text-sm text-slate-500">A real-time overview of students, examinations and outcomes.</p><Button onClick={() => go("tests")}><Plus size={16} /> Create examination</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric Icon={Users} title="Active students" value={overview.students} caption="Active student accounts" color="bg-indigo-50 text-brand" />
      <Metric Icon={GraduationCap} title="Teachers" value={overview.teachers} caption="Academic team members" color="bg-emerald-50 text-emerald-600" />
      <Metric Icon={FileQuestion} title="Examinations" value={overview.tests} caption="Created on the platform" color="bg-amber-50 text-amber-600" />
      <Metric Icon={Activity} title="Submissions" value={overview.submissions} caption="Completed attempts" color="bg-rose-50 text-rose-600" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <Card><div className="mb-5 flex items-center justify-between"><div><h2 className="heading-font font-extrabold text-slate-900">Recent submissions</h2><p className="mt-1 text-xs text-slate-500">Latest completed examination attempts</p></div><button onClick={() => go("results")} className="text-sm font-bold text-brand">View reports</button></div>
        {overview.recent_results?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="pb-3">Student</th><th className="pb-3">Examination</th><th className="pb-3">Score</th></tr></thead><tbody className="divide-y divide-slate-100">{overview.recent_results.map((result, index) => <tr key={`${result.test_title}-${index}`}><td className="py-3 font-semibold">{result.student_name}</td><td className="py-3 text-slate-500">{result.test_title}</td><td className="py-3 font-bold text-brand">{result.percentage}%</td></tr>)}</tbody></table></div> : <p className="py-12 text-center text-sm text-slate-400">Completed attempts will appear here.</p>}
      </Card>
      <Card><div className="mb-5"><h2 className="heading-font font-extrabold text-slate-900">Performance snapshot</h2><p className="mt-1 text-xs text-slate-500">Calculated from submitted results</p></div><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={scores} margin={{ left: -20, right: 8 }}><CartesianGrid stroke="#eef0f6" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#5b67f1" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="flex items-center gap-2 text-sm text-slate-500"><Award size={17} className="text-emerald-500" />Pass rate: <b className="text-emerald-700">{overview.pass_rate ?? 0}%</b></div></Card>
    </div>
  </div>;
}
