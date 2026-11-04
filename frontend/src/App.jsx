import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Award, BarChart3, Bell, BookOpenCheck,
  ChevronDown, ChevronRight, CircleHelp, Clock3,
  CloudUpload, FileQuestion, FileSpreadsheet, GraduationCap, LayoutDashboard, LogOut,
  Menu, Megaphone, MoreHorizontal, Plus, Search, ShieldCheck, Sparkles, Target, Users, X,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import api, { messageFromError } from "./api";
import { useAuth } from "./auth/AuthContext";
import { Button, Card, Notice, Spinner } from "./components/ui";
import AIQuestionGenerator from "./pages/admin/AIQuestionGenerator";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import ExamRoom from "./pages/student/ExamRoom";
import AdminLayout from "./components/layout/AdminLayout";
import StudentLayout from "./components/layout/StudentLayout";
import CatalogsPage from "./pages/admin/CatalogsPage";
import ProfilePage from "./pages/ProfilePage";
import { login, registerStudent } from "./api/auth";
import { uploadQuestionImage } from "./api/media";
import ActivityLogsPage from "./pages/admin/ActivityLogsPage";
import QuestionBankPage from "./pages/admin/QuestionBankPage";
import QuestionBankPicker from "./pages/admin/QuestionBankPicker";
import { useLocation, useNavigate } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import CommunicationsPage from "./pages/CommunicationsPage";

const cx = (...values) => values.filter(Boolean).join(" ");

function Field({ label, className = "", ...props }) {
  return <label className={cx("block text-sm font-semibold text-slate-700", className)}>{label}<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-indigo-100" {...props} /></label>;
}

function SelectField({ label, children, className = "", ...props }) {
  return <label className={cx("block text-sm font-semibold text-slate-700", className)}>{label}<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-800 outline-none focus:border-brand focus:ring-4 focus:ring-indigo-100" {...props}>{children}</select></label>;
}

function TextArea({ label, className = "", ...props }) {
  return <label className={cx("block text-sm font-semibold text-slate-700", className)}>{label}<textarea className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-indigo-100" {...props} /></label>;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600", green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700", red: "bg-rose-50 text-rose-700", blue: "bg-indigo-50 text-indigo-700",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize", tones[tone] || tones.slate)}>{children}</span>;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", batch: "", course: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = mode === "login"
        ? await login({ email: form.email, password: form.password })
        : await registerStudent(form);
      onAuthenticated(data);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy p-5">
    <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
    <div className="absolute -bottom-40 -right-20 h-[30rem] w-[30rem] rounded-full bg-emerald-400/10 blur-3xl" />
    <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-lift md:grid-cols-[1.05fr_.95fr]">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white md:flex">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><GraduationCap /></div><span className="heading-font text-xl font-extrabold">elevate<span className="text-indigo-200">.</span></span></div>
        <div><Badge tone="slate">LEARN · PRACTICE · EXCEL</Badge><h1 className="heading-font mt-7 text-4xl font-extrabold leading-tight">Your next big<br />breakthrough starts here.</h1><p className="mt-5 max-w-sm leading-7 text-indigo-100">A focused space to challenge yourself, measure progress, and reach your potential.</p></div>
        <div className="flex items-center gap-3 text-sm text-indigo-100"><ShieldCheck size={18} /> Secure assessments. Meaningful progress.</div>
      </div>
      <div className="px-7 py-9 sm:px-12 sm:py-12">
        <div className="mb-9 flex items-center gap-3 md:hidden"><div className="rounded-xl bg-indigo-50 p-2 text-brand"><GraduationCap /></div><span className="heading-font text-xl font-extrabold">elevate.</span></div>
        <span className="text-xs font-bold uppercase tracking-[.2em] text-brand">{mode === "login" ? "Welcome back" : "Start your journey"}</span>
        <h2 className="heading-font mt-2 text-3xl font-extrabold text-slate-900">{mode === "login" ? "Sign in to Elevate" : "Create your account"}</h2>
        <p className="mt-2 text-sm text-slate-500">{mode === "login" ? "Enter your credentials to continue." : "Your next practice session is one step away."}</p>
        {error && <div className="mt-5"><Notice>{error}</Notice></div>}
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {mode === "register" && <Field label="Full name" autoComplete="name" required value={form.name} onChange={update("name")} placeholder="Your name" minLength={2} />}
          <Field label="Email address" type="email" autoComplete="email" required value={form.email} onChange={update("email")} placeholder="you@example.com" />
          <Field label="Password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={form.password} onChange={update("password")} placeholder="At least 8 characters" />
          <Button type="submit" className="mt-2 w-full py-3.5" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create student account"}<ArrowRight size={17} /></Button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-500">{mode === "login" ? "New to Elevate?" : "Already have an account?"}{" "}
          <button className="font-bold text-brand hover:underline" onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}>{mode === "login" ? "Create an account" : "Sign in"}</button>
        </p>
        <p className="mt-8 text-center text-xs text-slate-400">By continuing, you agree to follow examination integrity guidelines.</p>
      </div>
    </div>
  </main>;
}

function Sidebar({ user, page, setPage, onLogout, open, onClose }) {
  const hasAdminAccess = ["admin", "superadmin"].includes(user.role);
  const studentLinks = [
    ["overview", "Overview", LayoutDashboard], ["exams", "My examinations", BookOpenCheck],
    ["results", "My results", Award], ["leaderboard", "Leaderboard", BarChart3],
    ["communications", "Help & announcements", Megaphone],
    ["profile", "My profile", Users],
  ];
  const allStaffLinks = [
    ["overview", "Overview", LayoutDashboard], ["tests", "Examinations", FileQuestion],
    ["questionBank", "Question bank", BookOpenCheck],
    ...(hasAdminAccess ? [["people", user.role === "superadmin" ? "People & admin access" : "Students", Users], ["catalogs", "Batches & courses", BookOpenCheck], ["analytics", "Analytics", BarChart3], ["activity", "Integrity logs", ShieldCheck]] : []),
    ["results", "Results", Award], ["leaderboard", "Leaderboard", Activity],
    ["communications", "Announcements & support", Megaphone], ["profile", "My profile", Users],
  ];
  const staffLinks = user.role === "question_manager"
    ? [["overview", "Overview", LayoutDashboard], ["questionBank", "Question bank", BookOpenCheck], ["communications", "Announcements & support", Megaphone], ["profile", "My profile", Users]]
    : user.role === "exam_manager"
      ? [["overview", "Overview", LayoutDashboard], ["tests", "Examinations", FileQuestion], ["results", "Results", Award], ["analytics", "Analytics", BarChart3], ["activity", "Integrity logs", ShieldCheck], ["communications", "Announcements & support", Megaphone], ["profile", "My profile", Users]]
      : allStaffLinks;
  const links = user.role === "student" ? studentLinks : staffLinks;
  return <>
    {open && <button aria-label="Close menu" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" />}
    <aside className={cx("fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col overflow-y-auto bg-navy px-4 pb-5 pt-6 text-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center gap-3 px-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-brand"><GraduationCap size={22} /></div><span className="heading-font text-xl font-extrabold tracking-tight">elevate<span className="text-indigo-300">.</span></span></div>
      <div className="mx-3 mb-3 mt-10 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Workspace</div>
      <nav className="space-y-1">
        {links.map(([key, label, Icon]) => <button key={key} onClick={() => { setPage(key); onClose(); }} className={cx("flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition", page === key ? "bg-brand text-white shadow-lg shadow-indigo-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white")}><Icon size={18} />{label}{page === key && <ChevronRight className="ml-auto" size={16} />}</button>)}
      </nav>
      <div className="mt-auto">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-200"><Sparkles size={14} /> YOUR LEARNING SPACE</div>
          <p className="text-xs leading-5 text-slate-400">Every attempt is progress. Keep showing up and your results will follow.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border-t border-white/10 px-2 pt-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-200">{user.name?.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{user.name}</div><div className="text-xs capitalize text-slate-500">{user.role}</div></div>
          <button onClick={onLogout} aria-label="Sign out" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
  </>;
}

function Topbar({ user, title, onMenu, onSearch, onNavigate, onLogout }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  const refreshNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications", { params: { limit: 20 } });
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
      setNotificationError("");
    } catch (error) {
      setNotificationError(messageFromError(error));
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [refreshNotifications]);

  async function markAllRead() {
    try {
      await api.post("/notifications/read-all");
      await refreshNotifications();
    } catch (error) {
      setNotificationError(messageFromError(error));
    }
  }

  async function openNotification(notification) {
    if (!notification.read_at) {
      try {
        await api.patch(`/notifications/${notification._id}/read`);
        await refreshNotifications();
      } catch (error) {
        setNotificationError(messageFromError(error));
        return;
      }
    }
    setNotificationsOpen(false);
    if (notification.link) onNavigate(notification.link);
  }

  return <header className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between gap-2 border-b border-slate-100 bg-white/90 px-3 backdrop-blur-xl sm:min-h-[76px] sm:px-5 lg:px-8">
    <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button aria-label="Open navigation menu" className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden" onClick={onMenu}><Menu size={21} /></button><div className="min-w-0"><div className="hidden text-xs font-medium text-slate-400 sm:block">Workspace / <span className="capitalize">{title}</span></div><div className="heading-font mt-0.5 truncate text-base font-extrabold capitalize text-slate-900 sm:text-lg">{title === "overview" ? `Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${user.name.split(" ")[0]}` : title}</div></div></div>
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
      <div className="relative">
        <button aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <Bell size={19} />
          {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-5 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </button>
        {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(90vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div className="font-bold text-slate-800">Notifications</div><button onClick={markAllRead} disabled={!unreadCount} className="text-xs font-semibold text-brand disabled:text-slate-300">Mark all read</button></div>
          {notificationError && <p className="px-4 py-2 text-xs text-rose-600">{notificationError}</p>}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length ? notifications.map((item) => <button key={item._id} onClick={() => openNotification(item)} className={cx("block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50", !item.read_at && "bg-indigo-50/50")}>
              <span className="flex items-start gap-2"><span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.read_at ? "bg-transparent" : "bg-brand")} /><span><span className="block text-sm font-semibold text-slate-800">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.body}</span><span className="mt-1 block text-[10px] text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</span></span></span>
            </button>) : <div className="px-4 py-10 text-center text-sm text-slate-400">You’re all caught up.</div>}
          </div>
        </div>}
      </div>
      <div className="hidden items-center gap-2 sm:flex"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input onChange={(event) => onSearch(event.target.value)} placeholder="Search..." className="w-36 rounded-xl border-0 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:bg-white focus:ring-indigo-200 md:w-48" /></div></div>
      <button type="button" onClick={() => onNavigate("/profile")} aria-label="Open profile" title="My profile" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-brand transition hover:scale-105 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{user.name?.slice(0, 1).toUpperCase()}</button>
      <button type="button" onClick={onLogout} aria-label="Log out" title="Log out" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl px-2.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 sm:px-3"><LogOut size={17} /><span className="hidden text-sm font-semibold md:inline">Log out</span></button>
    </div>
  </header>;
}

function Stat({ icon: Icon, label, value, note, color = "indigo" }) {
  const colors = { indigo: "bg-indigo-50 text-brand", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600" };
  return <Card className="p-5"><div className="flex items-start justify-between"><div><div className="text-sm font-medium text-slate-500">{label}</div><div className="heading-font mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div></div><div className={cx("rounded-xl p-3", colors[color])}><Icon size={20} /></div></div><div className="mt-4 text-xs text-slate-400">{note}</div></Card>;
}

function SectionTitle({ title, subtitle, action }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="heading-font text-xl font-extrabold text-slate-900">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>{action}</div>;
}

function EmptyState({ icon: Icon = FileQuestion, title, text, action }) {
  return <div className="flex flex-col items-center justify-center py-14 text-center"><div className="rounded-2xl bg-indigo-50 p-4 text-brand"><Icon size={25} /></div><h3 className="mt-4 font-bold text-slate-800">{title}</h3><p className="mt-1 max-w-xs text-sm text-slate-500">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function TestCard({ test, onStart }) {
  const statusTone = { upcoming: "blue", available: "green", in_progress: "amber", completed: "slate", closed: "red" }[test.status] || "slate";
  const date = test.scheduled_at ? new Date(test.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Available now";
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-card">
    <div className="flex items-start justify-between gap-2"><div className="rounded-xl bg-indigo-50 p-2.5 text-brand"><FileQuestion size={19} /></div><Badge tone={statusTone}>{test.status?.replace("_", " ") || "draft"}</Badge></div>
    <h3 className="mt-4 font-bold text-slate-900">{test.title}</h3><p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{test.description || "A focused assessment to help you track your progress."}</p>
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><span className="flex items-center gap-1"><Clock3 size={14} />{test.duration_minutes} min</span><span className="flex items-center gap-1"><FileQuestion size={14} />{test.question_count} questions</span><span className="flex items-center gap-1"><Target size={14} />{test.total_marks_per_attempt ?? test.total_marks} marks</span></div>
    <div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-slate-400">{date}</span>{test.status === "completed" ? <Badge tone={test.result?.passed ? "green" : "amber"}>{test.result?.percentage}% · {test.result?.passed ? "Passed" : "Review"}</Badge> : test.status === "closed" ? null : <Button className="px-3 py-2 text-xs" onClick={onStart}>{test.status === "in_progress" ? "Resume" : test.status === "upcoming" ? "View details" : "Start exam"}<ArrowRight size={14} /></Button>}</div>
  </article>;
}

function PeoplePage({ users, refresh, search, user }) {
  const isSuperadmin = user.role === "superadmin";
  const [role, setRole] = useState(user.role === "superadmin" ? "all" : "student");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student", batch: "", course: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const visible = users.filter((user) => (role === "all" || user.role === role) && `${user.name} ${user.email} ${user.batch || ""} ${user.course || ""}`.toLowerCase().includes(search.toLowerCase()));
  async function create(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await api.post("/admin/users", form); setModal(false); setForm({ name: "", email: "", password: "", role: "student", batch: "", course: "" }); await refresh(); }
    catch (err) { setError(messageFromError(err)); }
    finally { setBusy(false); }
  }
  async function importCsv(file) {
    if (!file) return;
    const data = new FormData(); data.append("file", file);
    try {
      const response = await api.post("/admin/users/import", data);
      if (response.data.credentials?.length) {
        const csv = ["email,temporary_password", ...response.data.credentials.map((item) => `${item.email},${item.temporary_password}`)].join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = "student-temporary-credentials.csv"; anchor.click(); URL.revokeObjectURL(url);
      }
      window.alert(`Imported ${response.data.inserted} students. Skipped: ${response.data.skipped.length}.${response.data.credentials?.length ? " Temporary credentials were downloaded once." : ""}`);
      await refresh();
    }
    catch (err) { window.alert(messageFromError(err)); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }
  async function toggleActive(user) {
    const action = user.active ? "deactivate" : "reactivate";
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${user.name}'s account?`)) return;
    try { await api.patch(`/admin/users/${user.id}`, { active: !user.active }); await refresh(); } catch (err) { window.alert(messageFromError(err)); }
  }
  async function updateUser(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await api.patch(`/admin/users/${editing.id}`, {
        name: form.name, role: form.role, batch: form.batch || null, course: form.course || null,
      });
      setEditing(null); await refresh();
    } catch (err) { setError(messageFromError(err)); }
    finally { setBusy(false); }
  }
  return <div>
    <SectionTitle title={isSuperadmin ? "People" : "Students"} subtitle={isSuperadmin ? "Manage students, teachers and staff access." : "Manage student accounts only."} action={<div className="flex flex-wrap gap-2"><input ref={fileRef} hidden type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => importCsv(e.target.files?.[0])} /><Button variant="secondary" onClick={() => fileRef.current?.click()}><CloudUpload size={16} /> Import students</Button><Button onClick={() => { setError(""); setModal(true); }}><Plus size={16} /> Add student</Button></div>} />
    <Card className="p-0"><div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">{(isSuperadmin ? ["all", "student", "teacher", "admin", "question_manager", "exam_manager", "superadmin"] : ["student"]).map((item) => <button key={item} onClick={() => setRole(item)} className={cx("rounded-full px-4 py-2 text-xs font-bold capitalize", role === item ? "bg-indigo-50 text-brand" : "text-slate-500 hover:bg-slate-50")}>{item === "all" ? "Everyone" : `${item.replace("_", " ")}${item === "student" || item === "teacher" ? "s" : ""}`}</button>)}</div>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400"><tr>{["Name", "Role", "Batch / course", "Joined", "Status", ""].map((x) => <th key={x} className="px-5 py-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map((person) => <tr key={person.id} className="hover:bg-slate-50/50"><td className="px-5 py-4"><div className="font-bold text-slate-800">{person.name}</div><div className="mt-0.5 text-xs text-slate-400">{person.email}</div></td><td className="px-5 py-4"><Badge tone={person.role === "superadmin" ? "red" : person.role === "admin" ? "blue" : "slate"}>{person.role}</Badge></td><td className="px-5 py-4 text-slate-500">{[person.batch, person.course].filter(Boolean).join(" · ") || "—"}</td><td className="px-5 py-4 text-slate-500">{person.created_at ? new Date(person.created_at).toLocaleDateString() : "—"}</td><td className="px-5 py-4"><Badge tone={person.active ? "green" : "red"}>{person.active ? "Active" : "Inactive"}</Badge></td><td className="px-5 py-4">{person.role === "superadmin" ? <span className="text-xs text-slate-400">Protected owner</span> : <div className="flex items-center gap-3"><button className="text-xs font-bold text-brand hover:underline" onClick={() => { setEditing(person); setForm({ name: person.name, email: person.email, password: "", role: person.role, batch: person.batch || "", course: person.course || "" }); setError(""); }}>Edit</button><button className="text-xs font-bold text-slate-500 hover:text-brand" onClick={() => toggleActive(person)}>{person.active ? "Deactivate" : "Reactivate"}</button></div>}</td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No people found" text="Try another search or add a new person." />}
    </Card>
    {modal && <Modal title={isSuperadmin ? "Create account or grant role access" : "Add student"} onClose={() => setModal(false)}><form className="space-y-4" onSubmit={create}>{error && <Notice>{error}</Notice>}{isSuperadmin && <Notice tone="success">Only you can grant Admin, Teacher, Question Manager, or Exam Manager access.</Notice>}<Field label="Full name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Field label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Field label="Temporary password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="student">Student</option>{isSuperadmin && <><option value="teacher">Teacher</option><option value="admin">Admin</option><option value="question_manager">Question Manager</option><option value="exam_manager">Exam Manager</option></>}</SelectField><Field label="Batch (optional)" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} /></div><Field label="Course (optional)" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} /><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" type="button" onClick={() => setModal(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Creating…" : "Create account"}</Button></div></form></Modal>}
    {editing && <Modal title="Edit account" onClose={() => setEditing(null)}><form className="space-y-4" onSubmit={updateUser}>{error && <Notice>{error}</Notice>}<Field label="Full name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Field label="Email" type="email" disabled value={form.email} onChange={() => {}} /><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="student">Student</option>{isSuperadmin && <><option value="teacher">Teacher</option><option value="admin">Admin</option><option value="question_manager">Question Manager</option><option value="exam_manager">Exam Manager</option></>}</SelectField><Field label="Batch (optional)" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} /></div><Field label="Course (optional)" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} /><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div></form></Modal>}
  </div>;
}

function Modal({ title, children, onClose, wide = false }) {
  return <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={cx("my-auto max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-lift sm:p-8", wide ? "max-w-3xl" : "max-w-xl")}><div className="mb-6 flex items-start justify-between"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-brand">Elevate platform</div><h2 className="heading-font mt-1 text-2xl font-extrabold text-slate-900">{title}</h2></div><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button></div>{children}</div></div>;
}

function QuestionEditor({ question, update, remove }) {
  const imageFile = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const choices = ["single", "multiple", "reasoning"].includes(question.type);
  const correct = Array.isArray(question.correct_answer) ? question.correct_answer.join(" | ") : question.correct_answer || "";
  async function uploadImage(file) {
    if (!file) return;
    setUploadingImage(true);
    setImageError("");
    try { update({ image_url: await uploadQuestionImage(file) }); }
    catch (error) { setImageError(messageFromError(error)); }
    finally { setUploadingImage(false); imageFile.current.value = ""; }
  }
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="mb-4 flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Question</div><button type="button" onClick={remove} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><X size={16} /></button></div>
    <TextArea label="Question text" rows={2} required value={question.text} onChange={(e) => update({ text: e.target.value })} placeholder="Write the question…" />
    <Field className="mt-3" label="Section" required maxLength={120} value={question.section || "General"} onChange={(e) => update({ section: e.target.value })} placeholder="General" />
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_130px_120px]"><SelectField label="Question type" value={question.type} onChange={(e) => update({ type: e.target.value, options: ["single", "multiple", "reasoning"].includes(e.target.value) ? (question.options?.length >= 4 ? question.options : ["", "", "", ""]) : [] })}><option value="single">Single answer</option><option value="multiple">Multiple answers</option><option value="numerical">Numerical</option><option value="reasoning">Reasoning</option></SelectField><Field label="Marks" type="number" min="0.1" step="0.1" required value={question.marks} onChange={(e) => update({ marks: Number(e.target.value) })} /><div className="flex items-end pb-3 text-xs text-slate-400">{choices ? "Choose options below" : "Numeric response"}</div></div>
    {choices && <TextArea className="mt-3" label="Answer options (one per line, at least four)" rows={4} required value={(question.options || []).join("\n")} onChange={(e) => update({ options: e.target.value.split("\n") })} placeholder={"Option A\nOption B\nOption C\nOption D"} />}
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><Field label="Diagram image URL (optional, HTTPS)" value={question.image_url || ""} onChange={(e) => update({ image_url: e.target.value })} placeholder="https://… or upload below" /><div className="flex items-end"><input ref={imageFile} hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => uploadImage(event.target.files?.[0])} /><Button type="button" variant="secondary" disabled={uploadingImage} onClick={() => imageFile.current?.click()}>{uploadingImage ? "Uploading…" : "Upload image"}</Button></div></div>
    {imageError && <p className="mt-1 text-xs text-rose-600">{imageError}</p>}
    <TextArea className="mt-3" label="Math expression (optional)" rows={2} value={question.math_expression || ""} onChange={(e) => update({ math_expression: e.target.value })} />
    <Field className="mt-3" label={question.type === "multiple" ? "Correct answers (separate with |)" : "Correct answer"} required value={correct} onChange={(e) => update({ correct_answer: question.type === "multiple" ? e.target.value.split("|").map((x) => x.trim()).filter(Boolean) : e.target.value })} placeholder={question.type === "multiple" ? "Option A | Option C" : "Exact answer or option text"} />
    <Field className="mt-3" label="Explanation (optional)" value={question.explanation || ""} onChange={(e) => update({ explanation: e.target.value })} placeholder="Explain the solution after the exam" />
  </div>;
}

function TestEditor({ test, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: test?.title || "", description: test?.description || "", instructions: test?.instructions || "", duration_minutes: test?.duration_minutes || 30,
    questions_per_attempt: test?.questions_per_attempt || "",
    randomize_questions: test?.randomize_questions ?? true, randomize_options: test?.randomize_options ?? true,
    negative_marks: test?.negative_marks ?? 0, passing_percentage: test?.passing_percentage ?? 40,
    access_code: "", clear_access_code: false, has_access_code: test?.has_access_code || false,
    allowed_attempts: test?.allowed_attempts ?? 1, result_visibility: test?.result_visibility || "immediate",
    show_explanations: test?.show_explanations ?? true, violation_limit: test?.violation_limit ?? 1,
    immediate_submit_events: test?.immediate_submit_events || ["tab_switch", "visibility_change", "fullscreen_exit", "window_blur"],
    scheduled_at: test?.scheduled_at ? new Date(test.scheduled_at).toISOString().slice(0, 16) : "",
    closes_at: test?.closes_at ? new Date(test.closes_at).toISOString().slice(0, 16) : "",
    student_ids: test?.student_ids || [], batch: test?.batch || "", published: test?.published || false,
    questions: test?.questions || [],
  });
  const [sectionTimeText, setSectionTimeText] = useState(
    Object.entries(test?.section_time_limits || {}).map(([section, minutes]) => `${section}: ${minutes}`).join("\n"),
  );
  const [assigned, setAssigned] = useState((test?.student_ids || []).join(", "));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [questionBankOpen, setQuestionBankOpen] = useState(false);
  const questionFile = useRef(null);
  useEffect(() => {
    api.get("/staff/students").then(({ data }) => setStudents(data)).catch((err) => setError(messageFromError(err)));
  }, []);
  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function changeQuestion(index, patch) { const questions = [...form.questions]; questions[index] = { ...questions[index], ...patch }; change("questions", questions); }
  function appendQuestions(incoming, negativeMarks) {
    const existing = new Set(form.questions.map((question) => question.text?.trim().replace(/\s+/g, " ").toLocaleLowerCase()).filter(Boolean));
    const additions = incoming.map((question) => ({ ...question, text: question.text?.trim() || "" }));
    if (form.questions.length + additions.length > 149) {
      setError("An examination can contain at most 149 questions.");
      return false;
    }
    const additionsTexts = additions.map((question) => question.text.replace(/\s+/g, " ").toLocaleLowerCase());
    if (additions.some((question) => !question.text) || additionsTexts.some((text) => existing.has(text)) || new Set(additionsTexts).size !== additionsTexts.length) {
      setError("Question text must be non-empty and unique within this examination.");
      return false;
    }
    change("questions", [...form.questions, ...additions]);
    if (negativeMarks !== undefined) change("negative_marks", negativeMarks);
    setError("");
    return true;
  }
  async function uploadQuestions(file) {
    if (!file) return;
    const data = new FormData(); data.append("file", file);
    try { await api.post(`/admin/tests/${test.id}/questions/import`, data); const loaded = await api.get(`/admin/tests/${test.id}`); change("questions", loaded.data.questions); }
    catch (err) { setError(messageFromError(err)); }
    finally { questionFile.current.value = ""; }
  }
  async function save(event) {
    event.preventDefault();
    setError("");
    const { has_access_code, ...examForm } = form;
    const sectionTimeLimits = {};
    for (const [index, rawLine] of sectionTimeText.split("\n").entries()) {
      const line = rawLine.trim();
      if (!line) continue;
      const separator = line.lastIndexOf(":");
      const section = line.slice(0, separator).trim();
      const minutes = Number(line.slice(separator + 1).trim());
      if (separator <= 0 || !section || !Number.isInteger(minutes) || minutes < 1 || sectionTimeLimits[section] !== undefined) {
        setError(`Invalid or duplicate section time on line ${index + 1}. Use "Section name: whole minutes".`);
        return;
      }
      sectionTimeLimits[section] = minutes;
    }
    const payload = {
      ...examForm,
      section_time_limits: sectionTimeLimits,
      access_code: form.access_code.trim() || null,
      duration_minutes: Number(form.duration_minutes),
      questions_per_attempt: form.questions_per_attempt ? Number(form.questions_per_attempt) : null,
      negative_marks: Number(form.negative_marks),
      passing_percentage: Number(form.passing_percentage),
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
      student_ids: assigned.split(",").map((value) => value.trim()).filter(Boolean),
      questions: form.questions.map((question) => ({
        ...question,
        text: question.text.trim(),
        marks: Number(question.marks),
        options: (question.options || []).map((option) => option.trim()).filter(Boolean),
      })),
    };
    if (payload.published && !payload.questions.length) { setError("Add at least one question before publishing."); return; }
    setBusy(true);
    try {
      if (test) await api.put(`/admin/tests/${test.id}`, payload);
      else await api.post("/admin/tests", payload);
      onSaved();
    } catch (err) { setError(messageFromError(err)); }
    finally { setBusy(false); }
  }
  return <Modal title={test ? "Edit examination" : "Create examination"} onClose={onClose} wide><form className="space-y-5" onSubmit={save}>
    {error && <Notice>{error}</Notice>}
    <div className="grid gap-4 sm:grid-cols-3"><Field label="Examination title" required minLength={3} value={form.title} onChange={(e) => change("title", e.target.value)} placeholder="e.g. Quantitative Aptitude · Mock 1" /><Field label="Duration (minutes)" type="number" min="1" max="600" required value={form.duration_minutes} onChange={(e) => change("duration_minutes", e.target.value)} /><Field label="Questions per attempt (optional)" type="number" min="1" max={Math.min(149, form.questions.length)} value={form.questions_per_attempt} onChange={(e) => change("questions_per_attempt", e.target.value)} placeholder="Use full pool" /></div>
    <TextArea label="Description" rows={2} value={form.description} onChange={(e) => change("description", e.target.value)} placeholder="What should students know about this exam?" />
    <TextArea label="Instructions shown before the exam" rows={3} value={form.instructions} onChange={(e) => change("instructions", e.target.value)} placeholder="Explain exam rules, allowed materials, and support contact…" />
    <TextArea label="Optional section timers (one per line: Section name: minutes)" rows={3} value={sectionTimeText} onChange={(e) => setSectionTimeText(e.target.value)} placeholder={"Quantitative: 20\nReasoning: 15"} />
    <p className="-mt-3 text-xs text-slate-500">Each section name must match a question’s Section field, and all section times together must fit within the exam duration.</p>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Opens at (optional)" type="datetime-local" value={form.scheduled_at} onChange={(e) => change("scheduled_at", e.target.value)} /><Field label="Closes at (optional)" type="datetime-local" value={form.closes_at} onChange={(e) => change("closes_at", e.target.value)} /></div>
    <div className="grid gap-4 sm:grid-cols-3"><Field label="Negative marks / wrong answer" type="number" min="0" step="0.25" value={form.negative_marks} onChange={(e) => change("negative_marks", e.target.value)} /><Field label="Pass percentage" type="number" min="0" max="100" value={form.passing_percentage} onChange={(e) => change("passing_percentage", e.target.value)} /><Field label="Allowed attempts" type="number" min="1" max="10" value={form.allowed_attempts} onChange={(e) => change("allowed_attempts", e.target.value)} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Result visibility" value={form.result_visibility} onChange={(e) => change("result_visibility", e.target.value)}><option value="immediate">Immediately after submission</option><option value="after_close">After exam closes</option><option value="hidden">Keep results private</option></SelectField><Field label={form.has_access_code ? "Change access code (leave blank to keep)" : "Exam access code (optional)"} type="password" autoComplete="new-password" value={form.access_code} onChange={(e) => change("access_code", e.target.value)} minLength={4} maxLength={64} /></div>
    {form.has_access_code && <label className="flex items-center gap-2 text-sm text-rose-700"><input type="checkbox" checked={form.clear_access_code} onChange={(e) => change("clear_access_code", e.target.checked)} />Remove the existing access code</label>}
    <div className="grid gap-4 sm:grid-cols-3"><Field label="Maximum violations before submit" type="number" min="1" max="20" value={form.violation_limit} onChange={(e) => change("violation_limit", e.target.value)} /><label className="flex items-center gap-2 self-end pb-3 text-sm text-slate-700"><input type="checkbox" checked={form.show_explanations} onChange={(e) => change("show_explanations", e.target.checked)} />Show explanations with results</label></div>
    <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">Immediate auto-submit violations</legend><div className="grid gap-2 sm:grid-cols-2">{[["visibility_change", "Tab hidden / switched"], ["window_blur", "Exam window loses focus"], ["fullscreen_exit", "Fullscreen exit"], ["copy", "Copy attempt"], ["paste", "Paste attempt"], ["cut", "Cut attempt"], ["context_menu", "Right-click"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.immediate_submit_events.includes(value)} onChange={(e) => change("immediate_submit_events", e.target.checked ? [...new Set([...form.immediate_submit_events, value])] : form.immediate_submit_events.filter((item) => item !== value))} />{label}</label>)}</div><p className="mt-3 text-xs text-slate-500">All detected violations are logged and counted. Non-immediate events submit at the configured violation limit.</p></fieldset>
    <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><input type="checkbox" checked={form.randomize_questions} onChange={(e) => change("randomize_questions", e.target.checked)} />Randomize question order</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><input type="checkbox" checked={form.randomize_options} onChange={(e) => change("randomize_options", e.target.checked)} />Randomize answer options</label></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Assign to batch (optional)" value={form.batch} onChange={(e) => change("batch", e.target.value)} placeholder="Exact batch name" /><Field label="Assign to student IDs (comma-separated, optional)" value={assigned} onChange={(e) => setAssigned(e.target.value)} placeholder="Leave blank to make available to everyone" /></div>
    {!!students.length && <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">Select individual students</legend><div className="mt-1 max-h-36 space-y-2 overflow-y-auto">{students.map((student) => { const selected = assigned.split(",").map((id) => id.trim()).includes(student.id); return <label key={student.id} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={selected} onChange={(event) => { const ids = new Set(assigned.split(",").map((id) => id.trim()).filter(Boolean)); if (event.target.checked) ids.add(student.id); else ids.delete(student.id); setAssigned([...ids].join(", ")); }} /><span className="font-medium text-slate-700">{student.name}</span><span className="text-xs text-slate-400">{student.email}{student.batch ? ` · ${student.batch}` : ""}</span></label>; })}</div></fieldset>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><div><h3 className="font-bold text-slate-900">Questions <span className="text-slate-400">({form.questions.length}/149)</span></h3><p className="mt-1 text-xs text-slate-500">Add manually, from the question bank, CSV/XLSX or an AI draft.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={form.questions.length >= 149} onClick={() => setQuestionBankOpen(true)}><BookOpenCheck size={15} /> Question bank</Button><Button type="button" variant="secondary" disabled={form.questions.length >= 149} onClick={() => setAiOpen(true)}><Sparkles size={15} /> Generate with AI</Button><input hidden ref={questionFile} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => uploadQuestions(e.target.files?.[0])} /><Button type="button" variant="secondary" disabled={!test || form.questions.length >= 149} onClick={() => questionFile.current?.click()} title={!test ? "Save the exam before importing questions" : ""}><CloudUpload size={15} /> Import CSV / XLSX</Button><Button type="button" variant="secondary" disabled={form.questions.length >= 149} onClick={() => change("questions", [...form.questions, { text: "", type: "single", section: form.questions[0]?.section || "General", category: "Quantitative Aptitude", difficulty: "intermediate", options: ["", "", "", ""], correct_answer: "", marks: 1, explanation: "" }])}><Plus size={15} /> Add question</Button></div></div>
    {!test && <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">Save this examination once to enable CSV question imports.</div>}
    <div className="space-y-4">{form.questions.map((question, index) => <QuestionEditor key={question.id || index} question={question} update={(patch) => changeQuestion(index, patch)} remove={() => change("questions", form.questions.filter((_, i) => i !== index))} />)}</div>
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={form.published} onChange={(e) => change("published", e.target.checked)} /><span><b className="text-slate-800">Publish examination</b><span className="mt-0.5 block text-xs text-slate-500">Published tests become visible to assigned students when their schedule opens.</span></span></label>
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-5"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : test ? "Save changes" : "Create examination"}</Button></div>
  </form>{aiOpen && <AIQuestionGenerator maxQuestions={149 - form.questions.length} existingQuestions={form.questions} initialNegativeMarks={form.negative_marks} onClose={() => setAiOpen(false)} onApproved={appendQuestions} />}{questionBankOpen && <QuestionBankPicker maxQuestions={149 - form.questions.length} existingQuestions={form.questions} onClose={() => setQuestionBankOpen(false)} onAdd={(questions) => { if (appendQuestions(questions)) setQuestionBankOpen(false); }} />}</Modal>;
}

function TestsPage({ tests, refresh, search, user }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState("all");
  const visible = tests.filter((test) => (status === "all" || (status === "published" ? test.published : !test.published)) && `${test.title} ${test.description}`.toLowerCase().includes(search.toLowerCase()));
  async function editTest(test) {
    try { const response = await api.get(`/admin/tests/${test.id}`); setEditing(response.data); setModal(true); }
    catch (err) { window.alert(messageFromError(err)); }
  }
  async function deleteTest(test) {
    if (!window.confirm(`Delete "${test.title}"? This is only allowed before any students start it.`)) return;
    try { await api.delete(`/admin/tests/${test.id}`); await refresh(); } catch (err) { window.alert(messageFromError(err)); }
  }
  return <div><SectionTitle title="Examinations" subtitle="Create, schedule and manage aptitude assessments." action={<Button onClick={() => { setEditing(null); setModal(true); }}><Plus size={16} /> New examination</Button>} />
    <Card className="mb-5 p-4"><div className="flex flex-wrap gap-2">{["all", "published", "draft"].map((key) => <button key={key} onClick={() => setStatus(key)} className={cx("rounded-full px-4 py-2 text-xs font-bold capitalize", status === key ? "bg-indigo-50 text-brand" : "text-slate-500 hover:bg-slate-50")}>{key}</button>)}</div></Card>
    {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((test) => <Card key={test.id} className="group transition hover:-translate-y-0.5 hover:shadow-card"><div className="flex items-start justify-between"><div className="rounded-xl bg-indigo-50 p-2.5 text-brand"><FileQuestion size={19} /></div><button title="Edit examination" onClick={() => editTest(test)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal size={19} /></button></div><h3 className="heading-font mt-4 text-lg font-extrabold text-slate-900">{test.title}</h3><p className="mt-1 min-h-10 text-sm text-slate-500">{test.description || "No description added."}</p><div className="mt-4 flex flex-wrap gap-2"><Badge tone={test.published ? "green" : "amber"}>{test.published ? "Published" : "Draft"}</Badge><Badge>{test.question_count} questions</Badge><Badge>{test.duration_minutes} min</Badge></div><div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">{test.scheduled_at ? new Date(test.scheduled_at).toLocaleString() : "No scheduled opening"} · {test.total_marks} marks</div><div className="mt-3 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => editTest(test)}>Edit</Button><Button variant="danger" className="px-3" title="Delete examination" onClick={() => deleteTest(test)}><X size={16} /></Button></div></Card>)}</div> : <Card><EmptyState icon={FileQuestion} title="No examinations found" text="Create a test to start assessing student progress." action={<Button onClick={() => setModal(true)}><Plus size={15} /> Create examination</Button>} /></Card>}
    {modal && <TestEditor test={editing} onClose={() => setModal(false)} onSaved={async () => { setModal(false); await refresh(); }} />}
  </div>;
}

function ResultsPage({ results, refresh, search, user, tests, total, offset, onPageChange, testFilter, setTestFilter }) {
  const [selectedResult, setSelectedResult] = useState(null);
  const visible = results.filter((result) => (user.role === "student" || testFilter === "all" || result.test_id === testFilter) && `${result.student_name || ""} ${result.test_title}`.toLowerCase().includes(search.toLowerCase()));
  async function exportFile(format) {
    try {
      const response = await api.get(`/admin/results/export?format=${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `examination-results.${format}`; anchor.click(); URL.revokeObjectURL(url);
    } catch (err) { window.alert(messageFromError(err)); }
  }
  async function inspectResult(result) {
    try { const response = await api.get(`/student/results/${result._id}`); setSelectedResult(response.data); }
    catch (err) { window.alert(messageFromError(err)); }
  }
  return <div><SectionTitle title={user.role === "student" ? "My results" : "Results & reports"} subtitle={user.role === "student" ? "Review your examination history and progress." : "Review attempts, compare scores and export reports."} action={user.role !== "student" && <div className="flex gap-2"><Button variant="secondary" onClick={() => exportFile("csv")}><ArrowDownToLine size={15} /> CSV</Button><Button variant="secondary" onClick={() => exportFile("xlsx")}><FileSpreadsheet size={15} /> Excel</Button></div>} />
    {user.role !== "student" && <Card className="mb-5 p-4"><SelectField className="max-w-xs" label="Filter by examination" value={testFilter} onChange={(e) => { setTestFilter(e.target.value); onPageChange(0); }}><option value="all">All examinations</option>{tests.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}</SelectField></Card>}
    <Card className="p-0">{visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400"><tr>{(user.role === "student" ? ["Examination", "Score", "Correct", "Submitted", "Result", ""] : ["Student", "Examination", "Score", "Correct", "Submitted", "Result"]).map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map((result) => <tr key={result._id} className="hover:bg-slate-50/50">{user.role !== "student" && <td className="px-5 py-4 font-semibold text-slate-800">{result.student_name}</td>}<td className="px-5 py-4 font-semibold text-slate-700">{result.test_title}</td><td className="px-5 py-4"><span className="font-bold text-slate-800">{result.score}/{result.total_marks}</span><span className="ml-2 text-xs text-slate-400">({result.percentage}%)</span></td><td className="px-5 py-4 text-slate-500">{result.correct_count}/{result.question_count}</td><td className="px-5 py-4 text-slate-500">{result.submitted_at ? new Date(result.submitted_at).toLocaleString() : "—"}</td><td className="px-5 py-4"><Badge tone={result.passed ? "green" : "amber"}>{result.passed ? "Passed" : "Needs review"}</Badge></td>{user.role === "student" && <td className="px-5 py-4"><button className="text-xs font-bold text-brand hover:underline" onClick={() => inspectResult(result)}>Review answers</button></td>}</tr>)}</tbody></table></div> : <EmptyState icon={Award} title="No results yet" text="Completed examination attempts will appear here." />}<div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>{total ? `${offset + 1}–${Math.min(offset + results.length, total)} of ${total}` : "0 results"}</span><div className="flex gap-2"><Button className="px-3 py-1.5 text-xs" variant="secondary" disabled={offset === 0} onClick={() => onPageChange(Math.max(0, offset - 25))}>Previous</Button><Button className="px-3 py-1.5 text-xs" variant="secondary" disabled={offset + 25 >= total} onClick={() => onPageChange(offset + 25)}>Next</Button></div></div></Card>
    {selectedResult && <Modal title="Performance report" onClose={() => setSelectedResult(null)} wide>{selectedResult.result_hidden ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-600">The administrator has configured this result to be released later or kept private.</div> : <><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-indigo-50 p-4"><div><h3 className="font-bold text-slate-900">{selectedResult.test_title}</h3><p className="mt-1 text-xs text-slate-500">{selectedResult.correct_count} correct · {selectedResult.attempted_count} attempted · {selectedResult.question_count} total</p></div><div className="text-right"><div className="heading-font text-2xl font-extrabold text-brand">{selectedResult.percentage}%</div><Badge tone={selectedResult.passed ? "green" : "amber"}>{selectedResult.passed ? "Passed" : "Keep practicing"}</Badge></div></div><div className="space-y-3">{(selectedResult.answers || []).map((item, index) => <article key={item.question_id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{index + 1}</span><div className="min-w-0 flex-1"><h4 className="font-semibold leading-6 text-slate-800">{item.question_text}</h4><div className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><p className={item.is_correct ? "text-emerald-700" : "text-rose-600"}><b>Your answer:</b> {Array.isArray(item.answer) ? item.answer.join(", ") : item.answer || "Not answered"}</p><p className="text-emerald-700"><b>Correct answer:</b> {Array.isArray(item.correct_answer) ? item.correct_answer.join(", ") : item.correct_answer}</p></div>{item.explanation && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{item.explanation}</p>}</div><Badge tone={item.is_correct ? "green" : "amber"}>{item.is_correct ? `+${item.marks}` : `${item.marks}`} marks</Badge></div></article>)}</div></>}</Modal>}
  </div>;
}

function AnalyticsPage({ analytics }) {
  return <div><SectionTitle title="Analytics" subtitle="A data-backed view of learner performance and engagement." />
    {!analytics.score_distribution?.length ? <Card><EmptyState icon={BarChart3} title="Analytics will appear here" text="Complete examinations to start building your performance insights." /></Card> : <div className="grid gap-5 xl:grid-cols-2">
      <Card><SectionTitle title="Score distribution" subtitle="Attempt count across percentage ranges."/><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.score_distribution} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="#eef0f6" vertical={false} /><XAxis dataKey="range" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#f7f8fc" }} /><Bar dataKey="count" fill="#5b67f1" radius={[7, 7, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div></Card>
      <Card><SectionTitle title="Submissions over time" subtitle="Recent monthly attempt volume."/><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.monthly_submissions} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}><defs><linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b67f1" stopOpacity={0.25} /><stop offset="95%" stopColor="#5b67f1" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#eef0f6" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="count" stroke="#5b67f1" strokeWidth={3} fill="url(#activityFill)" /></AreaChart></ResponsiveContainer></div></Card>
      <Card className="xl:col-span-2"><SectionTitle title="Examination performance" subtitle="Average percentage score and completed attempts per examination."/><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.test_performance} margin={{ top: 10, right: 12, left: -20, bottom: 25 }}><CartesianGrid stroke="#eef0f6" vertical={false} /><XAxis dataKey="test" axisLine={false} tickLine={false} angle={-10} textAnchor="end" interval={0} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="average" name="Average score %" fill="#25c59a" radius={[7, 7, 0, 0]} barSize={38} /><Bar dataKey="attempts" name="Attempts" fill="#a5adfa" radius={[7, 7, 0, 0]} barSize={38} /></BarChart></ResponsiveContainer></div></Card>
      {!!analytics.student_performance?.length && <Card className="xl:col-span-2 p-0"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Student performance</h2><p className="mt-1 text-xs text-slate-500">Highest average scores across completed attempts.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr>{["Student", "Attempts", "Average", "Pass rate"].map((item) => <th key={item} className="px-5 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{analytics.student_performance.map((row) => <tr key={row.student_id}><td className="px-5 py-3 font-medium text-slate-700">{row.student}</td><td className="px-5 py-3 text-slate-500">{row.attempts}</td><td className="px-5 py-3 font-bold text-brand">{row.average}%</td><td className="px-5 py-3 text-slate-500">{row.pass_rate}%</td></tr>)}</tbody></table></div></Card>}
    </div>}
  </div>;
}

function Leaderboard({ rows, tests, selected, onSelect, search, isStudent }) {
  const filtered = rows.filter((row) => `${row.student_name} ${row.test_title}`.toLowerCase().includes(search.toLowerCase()));
  return <div><SectionTitle title="Leaderboard" subtitle="Celebrate progress and see how you rank." />
    <Card className="mb-5 p-4"><SelectField className="max-w-sm" label="Examination" value={selected} onChange={(e) => onSelect(e.target.value)}><option value="">{isStudent ? "Select an examination" : "All examinations"}</option>{tests.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}</SelectField></Card>
    <Card className="p-0">{filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400"><tr>{["Rank", "Student", "Examination", "Percentage", "Score"].map((item) => <th key={item} className="px-5 py-3 font-semibold">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => <tr key={row._id} className="hover:bg-slate-50/50"><td className="px-5 py-4"><span className={cx("flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold", row.rank === 1 ? "bg-amber-100 text-amber-700" : row.rank === 2 ? "bg-slate-200 text-slate-600" : row.rank === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-500")}>{row.rank}</span></td><td className="px-5 py-4 font-bold text-slate-800">{row.student_name}</td><td className="px-5 py-4 text-slate-500">{row.test_title}</td><td className="px-5 py-4 font-bold text-brand">{row.percentage}%</td><td className="px-5 py-4 text-slate-500">{row.score}/{row.total_marks}</td></tr>)}</tbody></table></div> : <EmptyState icon={Award} title="The leaderboard is waiting" text="Scores will be ranked after the first exam is submitted." />}</Card>
  </div>;
}

function StudentExams({ tests, refresh, onStart, search }) {
  const [filter, setFilter] = useState("all");
  const visible = tests.filter((test) => (filter === "all" || test.status === filter) && `${test.title} ${test.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div><SectionTitle title="My examinations" subtitle="Your assigned assessments, schedules and results." />
    <div className="mb-5 flex flex-wrap gap-2">{["all", "available", "upcoming", "in_progress", "completed"].map((key) => <button key={key} onClick={() => setFilter(key)} className={cx("rounded-full px-4 py-2 text-xs font-bold capitalize", filter === key ? "bg-indigo-50 text-brand" : "text-slate-500 hover:bg-white")}>{key.replace("_", " ")}</button>)}</div>
    {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((test) => <TestCard key={test.id} test={test} onStart={() => onStart(test)} />)}</div> : <Card><EmptyState icon={BookOpenCheck} title="No examinations here" text="When your teacher assigns an examination, you’ll find it here." action={<Button variant="secondary" onClick={refresh}>Refresh</Button>} /></Card>}
  </div>;
}

function App() {
  const { user, loading: authLoading, authenticate, signOut, replaceUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathToPage = { "/": "overview", "/overview": "overview", "/people": "people", "/catalogs": "catalogs", "/examinations": "tests", "/question-bank": "questionBank", "/exams": "exams", "/results": "results", "/analytics": "analytics", "/leaderboard": "leaderboard", "/profile": "profile", "/activity": "activity", "/communications": "communications" };
  const pageToPath = { overview: "/", people: "/people", catalogs: "/catalogs", tests: "/examinations", questionBank: "/question-bank", exams: "/exams", results: "/results", analytics: "/analytics", leaderboard: "/leaderboard", profile: "/profile", activity: "/activity", communications: "/communications" };
  const page = pathToPage[location.pathname] || "overview";
  const setPage = useCallback((next) => navigate(pageToPath[next] || "/"), [navigate]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [resultsOffset, setResultsOffset] = useState(0);
  const [resultsTestFilter, setResultsTestFilter] = useState("all");
  const [analytics, setAnalytics] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedTest, setSelectedTest] = useState("");
  const [activeExam, setActiveExam] = useState(null);
  const [resumeSession, setResumeSession] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError("");
    try {
      if (user.role !== "student" && page === "overview") {
        const response = await api.get("/admin/overview"); setOverview(response.data);
      }
      if (page === "people") { const response = await api.get("/admin/users"); setUsers(response.data); }
      if (page === "tests") { const response = await api.get("/admin/tests"); setTests(response.data); }
      if (page === "exams") { const response = await api.get("/student/tests"); setTests(response.data); }
      if (page === "results") {
        const params = {
          offset: resultsOffset,
          limit: 25,
          search: search || undefined,
          test_id: resultsTestFilter === "all" ? undefined : resultsTestFilter,
        };
        const response = await api.get(user.role === "student" ? "/student/results" : "/admin/results", { params });
        setResults(response.data.items || []);
        setResultsTotal(response.data.total || 0);
        if (user.role !== "student") {
          const testResponse = await api.get("/admin/tests");
          setTests(testResponse.data);
        }
      }
      if (page === "analytics") { const response = await api.get("/admin/analytics"); setAnalytics(response.data); }
      if (page === "leaderboard" && user.role === "student") {
        const testResponse = await api.get("/student/tests");
        setTests(testResponse.data);
        const now = Date.now();
        const visibleTests = testResponse.data.filter((test) =>
          test.result_visibility !== "hidden" &&
          (test.result_visibility !== "after_close" || (test.closes_at && new Date(test.closes_at).getTime() <= now)),
        );
        const leaderboardTest = selectedTest || visibleTests[0]?.id;
        if (!selectedTest && leaderboardTest) setSelectedTest(leaderboardTest);
        if (leaderboardTest) {
          const response = await api.get("/leaderboard", { params: { test_id: leaderboardTest } });
          setLeaderboard(response.data);
        } else {
          setLeaderboard([]);
        }
      }
      if (page === "leaderboard" && user.role !== "student") {
        const [leaderboardResponse, testResponse] = await Promise.all([
          api.get("/leaderboard", { params: selectedTest ? { test_id: selectedTest } : {} }),
          api.get("/admin/tests"),
        ]);
        setLeaderboard(leaderboardResponse.data);
        setTests(testResponse.data);
      }
      if (user.role === "student" && page === "overview") {
        const [examResponse, resultResponse] = await Promise.all([api.get("/student/tests"), api.get("/student/results")]);
        setTests(examResponse.data); setResults(resultResponse.data.items || []); setResultsTotal(resultResponse.data.total || 0);
      }
    } catch (err) { setError(messageFromError(err)); }
    finally { setLoading(false); }
  }, [page, user, selectedTest, resultsOffset, resultsTestFilter, search]);

  useEffect(() => { refresh(); }, [refresh]);

  async function beginExam(test) {
    if (test.status === "upcoming") { setError("This examination has not opened yet."); return; }
    if (test.status === "in_progress") {
      try { await document.documentElement.requestFullscreen(); }
      catch { setError("Enable fullscreen before resuming the examination."); return; }
    }
    setResumeSession(test.session_id || null);
    setActiveExam(test);
  }
  function logout() {
    signOut(); setActiveExam(null); navigate("/login");
  }
  if (authLoading) return <div className="grid min-h-screen place-items-center bg-canvas"><Spinner /></div>;
  if (!user) return <AuthScreen onAuthenticated={(payload) => { authenticate(payload); navigate("/"); }} />;
  if (activeExam) return <ExamRoom key={`${activeExam.id}-${resumeSession || "new"}`} test={activeExam} sessionId={resumeSession} onExit={() => { setActiveExam(null); setResumeSession(null); setPage("results"); }} />;

  const visibleTests = user.role === "student" ? tests : [];
  const titleMap = { overview: "overview", people: "people", catalogs: "batches & courses", tests: "examinations", questionBank: "question bank", exams: "my examinations", results: "results", analytics: "analytics", leaderboard: "leaderboard", profile: "my profile", activity: "integrity logs", communications: "announcements & support" };
  const Layout = user.role === "student" ? StudentLayout : AdminLayout;
  return <ProtectedRoute roles={user.role === "student" ? ["student"] : ["admin", "teacher", "superadmin", "question_manager", "exam_manager"]}><Layout
    sidebar={<Sidebar user={user} page={page} setPage={(next) => { setError(""); setPage(next); }} onLogout={logout} open={menuOpen} onClose={() => setMenuOpen(false)} />}
    header={<Topbar user={user} title={titleMap[page] || page} onMenu={() => setMenuOpen(true)} onSearch={setSearch} onNavigate={(path) => navigate(path)} onLogout={logout} />}
  >
        {error && <div className="mb-5"><Notice onClose={() => setError("")}>{error}</Notice></div>}
        {loading ? <Card><Spinner /></Card> : <>
          {page === "overview" && (user.role === "student"
            ? <StudentDashboard tests={visibleTests} results={results} go={setPage} onStart={beginExam} />
            : <AdminDashboard overview={overview} go={setPage} onRefresh={refresh} />)}
          {page === "people" && ["admin", "superadmin"].includes(user.role) && <PeoplePage users={users} refresh={refresh} search={search} user={user} />}
          {page === "catalogs" && ["admin", "superadmin"].includes(user.role) && <CatalogsPage />}
          {page === "tests" && ["admin", "superadmin", "teacher", "exam_manager"].includes(user.role) && <TestsPage tests={tests} refresh={refresh} search={search} user={user} />}
          {page === "questionBank" && ["admin", "superadmin", "teacher", "question_manager"].includes(user.role) && <QuestionBankPage />}
          {page === "exams" && user.role === "student" && <StudentExams tests={tests} refresh={refresh} search={search} onStart={beginExam} />}
          {page === "results" && <ResultsPage results={results} refresh={refresh} search={search} user={user} tests={tests} total={resultsTotal} offset={resultsOffset} onPageChange={setResultsOffset} testFilter={resultsTestFilter} setTestFilter={setResultsTestFilter} />}
          {page === "analytics" && ["admin", "superadmin", "exam_manager"].includes(user.role) && <AnalyticsPage analytics={analytics} />}
          {page === "leaderboard" && <Leaderboard rows={leaderboard} tests={tests} selected={selectedTest} onSelect={setSelectedTest} search={search} isStudent={user.role === "student"} />}
          {page === "profile" && <ProfilePage user={user} onUpdated={replaceUser} />}
          {page === "activity" && ["admin", "superadmin", "exam_manager"].includes(user.role) && <ActivityLogsPage />}
          {page === "communications" && <CommunicationsPage />}
        </>}
        <footer className="mt-10 border-t border-slate-200/80 py-5 text-center text-xs text-slate-400">© {new Date().getFullYear()} Elevate Assessment Platform <span className="mx-2">·</span> Learn with purpose.</footer>
  </Layout></ProtectedRoute>;
}

export default App;
