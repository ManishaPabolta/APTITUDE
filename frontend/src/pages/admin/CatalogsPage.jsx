import { useEffect, useState } from "react";
import { BookOpen, Plus, Trash2, Users } from "lucide-react";
import { createCatalogItem, deleteCatalogItem, listCatalog } from "../../api/admin";
import { Button, Card, Notice } from "../../components/ui";

function Catalog({ kind, title, icon: Icon }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try { setItems(await listCatalog(kind)); }
    catch (reason) { setError(reason?.response?.data?.detail || reason.message); }
  }
  useEffect(() => { refresh(); }, [kind]);

  async function add(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await createCatalogItem(kind, name.trim()); setName(""); await refresh(); }
    catch (reason) { setError(reason?.response?.data?.detail || reason.message); }
    finally { setBusy(false); }
  }

  async function remove(item) {
    if (!window.confirm(`Delete "${item.name}" from the catalog? Existing student assignments are not changed.`)) return;
    try { await deleteCatalogItem(kind, item.id); await refresh(); }
    catch (reason) { setError(reason?.response?.data?.detail || reason.message); }
  }

  return <Card>
    <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-indigo-50 p-2.5 text-brand"><Icon size={19} /></span><div><h2 className="heading-font font-extrabold text-slate-900">{title}</h2><p className="text-xs text-slate-500">{items.length} saved</p></div></div>
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}
    <form onSubmit={add} className="flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={`New ${kind.slice(0, -1)} name`} /><Button disabled={busy}><Plus size={16} /> Add</Button></form>
    <div className="mt-4 space-y-2">{items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-sm font-medium text-slate-700">{item.name}</span><button aria-label={`Delete ${item.name}`} onClick={() => remove(item)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button></div>)}{items.length === 0 && <p className="py-5 text-center text-sm text-slate-400">Add your first {kind.slice(0, -1)}.</p>}</div>
  </Card>;
}

export default function CatalogsPage() {
  return <div><div className="mb-6"><h1 className="heading-font text-xl font-extrabold text-slate-900">Batches & courses</h1><p className="mt-1 text-sm text-slate-500">Maintain the catalog used when assigning learners and examinations.</p></div><div className="grid gap-5 lg:grid-cols-2"><Catalog kind="batches" title="Student batches" icon={Users} /><Catalog kind="courses" title="Courses" icon={BookOpen} /></div></div>;
}
