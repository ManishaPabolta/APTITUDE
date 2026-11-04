import { useState } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { updateMyProfile } from "../api/student";
import { Button, Card, Notice } from "../components/ui";

export default function ProfilePage({ user, onUpdated }) {
  const [form, setForm] = useState({ name: user.name, batch: user.batch || "", course: user.course || "", current_password: "", new_password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const payload = { name: form.name };
      if (form.new_password) Object.assign(payload, { current_password: form.current_password, new_password: form.new_password });
      onUpdated(await updateMyProfile(payload));
      setForm((current) => ({ ...current, current_password: "", new_password: "" }));
      setSuccess("Your profile has been updated.");
    } catch (reason) {
      setError(reason?.response?.data?.detail || reason.message || "Could not update your profile.");
    } finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl"><div className="mb-6"><h1 className="heading-font text-xl font-extrabold text-slate-900">My profile</h1><p className="mt-1 text-sm text-slate-500">Update your account information and password.</p></div><Card><div className="mb-6 flex items-center gap-4"><div className="rounded-2xl bg-indigo-50 p-4 text-brand"><UserRound size={25} /></div><div><h2 className="font-bold text-slate-800">{user.name}</h2><p className="text-sm text-slate-500">{user.email} · {user.role}</p></div></div>{error && <div className="mb-4"><Notice>{error}</Notice></div>}{success && <div className="mb-4"><Notice tone="success">{success}</Notice></div>}<form onSubmit={save} className="space-y-5"><label className="block text-sm font-semibold text-slate-700">Full name<input required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />  </label>{user.role === "student" && <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Batch<input readOnly className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-normal text-slate-500" value={form.batch || "Not assigned"} /></label><label className="block text-sm font-semibold text-slate-700">Course<input readOnly className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-normal text-slate-500" value={form.course || "Not assigned"} /></label></div>}<div className="border-t border-slate-100 pt-5"><h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800"><KeyRound size={17} /> Change password</h3><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Current password<input autoComplete="current-password" type="password" className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" value={form.current_password} onChange={(event) => setForm({ ...form, current_password: event.target.value })} /></label><label className="block text-sm font-semibold text-slate-700">New password<input autoComplete="new-password" type="password" minLength={8} maxLength={128} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal" value={form.new_password} onChange={(event) => setForm({ ...form, new_password: event.target.value })} /></label></div></div><div className="flex justify-end"><Button disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button></div></form></Card></div>;
}
