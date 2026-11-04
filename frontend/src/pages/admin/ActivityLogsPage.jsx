import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import api from "../../api";
import { Badge, Card, Notice } from "../../components/ui";
import { formatDate } from "../../utils/format";

const eventLabels = {
  tab_switch: "Tab switch", visibility_change: "Page hidden", fullscreen_exit: "Fullscreen exit",
  window_blur: "Window focus lost", copy: "Copy blocked", paste: "Paste blocked",
  cut: "Cut blocked", context_menu: "Context menu blocked",
};

export default function ActivityLogsPage() {
  const [events, setEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/admin/activity-logs"), api.get("/admin/audit-logs")])
      .then(([activityResponse, auditResponse]) => {
        setEvents(activityResponse.data);
        setAuditLogs(auditResponse.data);
      })
      .catch((reason) => setError(reason?.response?.data?.detail || reason.message || "Could not load activity logs."));
  }, []);

  return <div>
    <div className="mb-6"><h1 className="heading-font text-xl font-extrabold text-slate-900">Examination integrity logs</h1><p className="mt-1 text-sm text-slate-500">Suspicious browser activity and administrative changes.</p></div>
    <Card className="mb-6 p-0">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-800">Exam activity</h2></div>
      {error && <div className="p-5"><Notice>{error}</Notice></div>}
      {events.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr>{["Event", "Student", "Test", "Details", "Timestamp"].map((item) => <th key={item} className="px-5 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event._id}><td className="px-5 py-4"><Badge tone={event.event_type === "visibility_change" || event.event_type === "fullscreen_exit" ? "red" : "amber"}><ShieldAlert size={13} className="mr-1" />{eventLabels[event.event_type] || event.event_type}</Badge></td><td className="px-5 py-4 font-medium">{event.student_name || event.student_id}</td><td className="px-5 py-4 text-slate-600">{event.test_title || event.test_id}</td><td className="px-5 py-4 text-slate-500">{event.details || "—"}</td><td className="px-5 py-4 text-slate-500">{formatDate(event.timestamp)}</td></tr>)}</tbody></table></div> : <div className="py-10 text-center text-sm text-slate-400">No suspicious activity has been recorded.</div>}
    </Card>
    <Card className="p-0">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-800">Administrative audit trail</h2><p className="mt-1 text-xs text-slate-500">Recorded user, examination and question-bank changes.</p></div>
      {auditLogs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr>{["Action", "Actor", "Resource", "Details", "Timestamp"].map((item) => <th key={item} className="px-5 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{auditLogs.map((entry) => <tr key={entry._id}><td className="px-5 py-4"><Badge tone="blue">{entry.action.replaceAll("_", " ")}</Badge></td><td className="px-5 py-4 font-medium">{entry.actor_name || entry.actor_id} <span className="text-xs capitalize text-slate-400">({entry.actor_role})</span></td><td className="px-5 py-4 text-slate-600">{entry.resource_type}{entry.resource_id ? ` · ${entry.resource_id}` : ""}</td><td className="px-5 py-4 text-slate-500">{entry.details?.title || entry.details?.name || entry.details?.text || (entry.details?.fields ? entry.details.fields.join(", ") : entry.details?.inserted !== undefined ? `${entry.details.inserted} imported` : "—")}</td><td className="px-5 py-4 text-slate-500">{formatDate(entry.timestamp)}</td></tr>)}</tbody></table></div> : <div className="py-10 text-center text-sm text-slate-400">No administrative changes have been recorded.</div>}
    </Card>
  </div>;
}
