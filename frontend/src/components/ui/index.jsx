import { CheckCircle2, CircleHelp } from "lucide-react";

const cx = (...values) => values.filter(Boolean).join(" ");

export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-brand text-white hover:bg-indigo-600 shadow-sm shadow-indigo-200",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100",
  };
  return <button className={cx("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", styles[variant], className)} {...props}>{children}</button>;
}

export function Notice({ tone = "error", children, onClose }) {
  if (!children) return null;
  return <div className={cx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", tone === "error" ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-700")}>
    {tone === "error" ? <CircleHelp size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
    <span className="flex-1">{children}</span>{onClose && <button aria-label="Dismiss" onClick={onClose}>×</button>}
  </div>;
}

export function Spinner() {
  return <div className="flex min-h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-100 border-t-brand" /></div>;
}

export function Card({ children, className = "" }) {
  return <section className={cx("rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6", className)}>{children}</section>;
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-indigo-50 text-indigo-700",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize", tones[tone] || tones.slate)}>{children}</span>;
}
