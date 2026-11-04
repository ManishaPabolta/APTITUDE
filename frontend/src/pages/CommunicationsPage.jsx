import { useCallback, useEffect, useState } from "react";
import { Megaphone, MessageCircle, Send, Trash2 } from "lucide-react";
import api, { messageFromError } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, Notice, Spinner } from "../components/ui";

const isAdministrator = (role) => ["admin", "superadmin"].includes(role);
const isSupportStaff = (role) => ["admin", "superadmin", "exam_manager"].includes(role);

function dateLabel(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function CommunicationsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ticketForm, setTicketForm] = useState({ subject: "", category: "other", message: "" });
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", audience: "all" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [announcementResponse, ticketResponse] = await Promise.all([
        api.get(isAdministrator(user.role) ? "/admin/announcements" : "/announcements", { params: isAdministrator(user.role) ? { offset: 0, limit: 50 } : {} }),
        api.get("/support/tickets", { params: { offset: 0, limit: 50 } }),
      ]);
      const announcementData = announcementResponse.data;
      setAnnouncements(Array.isArray(announcementData) ? announcementData : announcementData.items || []);
      setTickets(ticketResponse.data.items || []);
      setError("");
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => { refresh(); }, [refresh]);

  async function submitTicket(event) {
    event.preventDefault();
    try {
      await api.post("/support/tickets", ticketForm);
      setTicketForm({ subject: "", category: "other", message: "" });
      setMessage("Your support request was submitted.");
      await refresh();
    } catch (reason) {
      setError(messageFromError(reason));
    }
  }

  async function publishAnnouncement(event) {
    event.preventDefault();
    try {
      await api.post("/admin/announcements", announcementForm);
      setAnnouncementForm({ title: "", body: "", audience: "all" });
      setMessage("Announcement published.");
      await refresh();
    } catch (reason) {
      setError(messageFromError(reason));
    }
  }

  async function updateTicket(ticket, status) {
    const responseText = window.prompt("Optional response to the requester:", ticket.response || "");
    if (responseText === null) return;
    try {
      await api.patch(`/admin/support/tickets/${ticket._id}`, { status, response: responseText || null });
      await refresh();
    } catch (reason) {
      setError(messageFromError(reason));
    }
  }

  async function removeAnnouncement(announcement) {
    if (!window.confirm(`Delete “${announcement.title}”?`)) return;
    try {
      await api.delete(`/admin/announcements/${announcement._id}`);
      await refresh();
    } catch (reason) {
      setError(messageFromError(reason));
    }
  }

  return <div className="space-y-6">
    <header><h1 className="heading-font text-xl font-extrabold text-slate-900">Announcements & support</h1><p className="mt-1 text-sm text-slate-500">Important platform updates and help requests.</p></header>
    {error && <Notice>{error}</Notice>}
    {message && <Notice tone="success" onClose={() => setMessage("")}>{message}</Notice>}
    {isAdministrator(user.role) && <Card>
      <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900"><Megaphone size={18} /> Publish announcement</h2>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={publishAnnouncement}>
        <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" required minLength={3} maxLength={180} placeholder="Title" value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} />
        <select className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={announcementForm.audience} onChange={(event) => setAnnouncementForm({ ...announcementForm, audience: event.target.value })}><option value="all">Everyone</option><option value="students">Students</option><option value="staff">Staff</option></select>
        <textarea className="min-h-24 rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2" required maxLength={10000} placeholder="Write the announcement…" value={announcementForm.body} onChange={(event) => setAnnouncementForm({ ...announcementForm, body: event.target.value })} />
        <div className="md:col-span-2"><Button><Send size={15} /> Publish</Button></div>
      </form>
    </Card>}
    <Card>
      <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900"><Megaphone size={18} /> Latest announcements</h2>
      {loading ? <Spinner /> : announcements.length ? <div className="space-y-3">{announcements.map((announcement) => <article key={announcement._id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-800">{announcement.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{announcement.body}</p><p className="mt-2 text-xs text-slate-400">{announcement.created_by_name || "Platform team"} · {dateLabel(announcement.published_at)}</p></div>{isAdministrator(user.role) && <button aria-label="Delete announcement" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeAnnouncement(announcement)}><Trash2 size={16} /></button>}</div></article>)}</div> : <p className="py-6 text-center text-sm text-slate-500">No announcements yet.</p>}
    </Card>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900"><MessageCircle size={18} /> Contact support</h2>
        <form className="space-y-3" onSubmit={submitTicket}>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" required minLength={3} maxLength={180} placeholder="Subject" value={ticketForm.subject} onChange={(event) => setTicketForm({ ...ticketForm, subject: event.target.value })} />
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={ticketForm.category} onChange={(event) => setTicketForm({ ...ticketForm, category: event.target.value })}><option value="exam">Examination</option><option value="account">Account</option><option value="technical">Technical issue</option><option value="other">Other</option></select>
          <textarea className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" required minLength={10} maxLength={5000} placeholder="Describe the issue and what you were doing…" value={ticketForm.message} onChange={(event) => setTicketForm({ ...ticketForm, message: event.target.value })} />
          <Button><Send size={15} /> Submit request</Button>
        </form>
      </Card>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">Support requests</h2>{isSupportStaff(user.role) && <Badge tone="blue">Staff view</Badge>}</div>
        {loading ? <Spinner /> : tickets.length ? <div className="space-y-3">{tickets.map((ticket) => <article key={ticket._id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-800">{ticket.subject}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{ticket.message}</p><p className="mt-2 text-xs text-slate-400">{ticket.user_name} · {ticket.category} · {dateLabel(ticket.created_at)}</p>{ticket.response && <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900"><b>Response:</b> {ticket.response}</p>}</div><Badge tone={ticket.status === "resolved" || ticket.status === "closed" ? "green" : "amber"}>{ticket.status.replaceAll("_", " ")}</Badge></div>{isSupportStaff(user.role) && <div className="mt-3 flex flex-wrap gap-2">{["in_progress", "resolved", "closed"].map((status) => <Button key={status} className="px-3 py-1.5 text-xs capitalize" variant="secondary" onClick={() => updateTicket(ticket, status)}>{status.replaceAll("_", " ")}</Button>)}</div>}</article>)}</div> : <p className="py-6 text-center text-sm text-slate-500">No support requests found.</p>}
      </Card>
    </div>
  </div>;
}
