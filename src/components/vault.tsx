"use client";

import { Camera, Download, ExternalLink, FilePlus2, FileText, NotebookPen, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReadAloud } from "./speech";
import { Button, Card, cn, EmptyState, Field, Input, Select, Textarea } from "./ui";

type Item = { id: string; kind: "file" | "note"; subject: string; name: string; type: string; size: number; date: number; blob?: Blob; text?: string };
const MAX = 20 * 1048576;
const DB = "cn-vault", STORE = "f";

/** IndexedDB on this device; falls back to memory (lost on reload) if the browser blocks storage. */
const idb = {
  db: null as IDBDatabase | null, mem: [] as Item[], blocked: false,
  open(): Promise<IDBDatabase | null> {
    return new Promise((res) => {
      if (this.db || this.blocked) return res(this.db);
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => { this.blocked = true; res(null); };
      } catch { this.blocked = true; res(null); }
    });
  },
  async all(): Promise<Item[]> {
    const db = await this.open(); if (!db) return [...this.mem];
    return new Promise((res) => { try { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => res((r.result as Item[]) ?? []); r.onerror = () => res([]); } catch { res([]); } });
  },
  async put(o: Item) {
    const db = await this.open(); if (!db) { this.mem.push(o); return true; }
    return new Promise<boolean>((res) => { try { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(o); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch { res(false); } });
  },
  async del(id: string) {
    const db = await this.open(); if (!db) { this.mem = this.mem.filter((x) => x.id !== id); return; }
    await new Promise<void>((res) => { try { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).delete(id); t.oncomplete = () => res(); t.onerror = () => res(); } catch { res(); } });
  },
};
const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function Vault({ subjects }: { subjects: string[] }) {
  const options = useMemo(() => [...new Set([...subjects, "Other"])], [subjects]);
  const [items, setItems] = useState<Item[] | null>(null);
  const [subject, setSubject] = useState(options[0]);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const load = async () => {
    const all = (await idb.all()).sort((a, b) => b.date - a.date);
    setItems(all);
    setUrls((old) => { Object.values(old).forEach((u) => URL.revokeObjectURL(u)); return Object.fromEntries(all.filter((x) => x.blob).map((x) => [x.id, URL.createObjectURL(x.blob!)])); });
  };
  useEffect(() => { void load(); }, []);

  const add = async (files: File[]) => {
    let ok = 0, big = 0;
    for (const f of files) { if (f.size > MAX) { big++; continue; } if (await idb.put({ id: uid(), kind: "file", subject, name: f.name || "photo.jpg", type: f.type, size: f.size, date: Date.now(), blob: f })) ok++; }
    setMsg([ok ? `${ok} saved.` : "", big ? `${big} too big (20 MB each at most).` : ""].join(" ").trim());
    await load();
  };
  const used = items ? [...new Set(items.map((x) => x.subject))] : [];
  const list = (items ?? []).filter((x) => filter === "all" || x.subject === filter);
  const total = (items ?? []).reduce((n, x) => n + x.size, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <Card className="h-fit space-y-4 p-5">
        <Field label="Subject" htmlFor="vault-subject"><Select id="vault-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</Select></Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><FilePlus2 className="size-4" /> Add files</Button>
          <Button variant="secondary" onClick={() => camRef.current?.click()}><Camera className="size-4" /> Take a photo</Button>
          <input ref={fileRef} type="file" multiple hidden data-testid="vault-file" onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ""; }} />
        </div>
        <div className="space-y-2 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><NotebookPen className="size-4 text-primary" /> Write a note</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Title" aria-label="Note title" />
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={6000} rows={4} placeholder="Your note" aria-label="Note text" />
          <Button size="sm" onClick={async () => {
            if (!title.trim() && !text.trim()) { setMsg("Write something first."); return; }
            await idb.put({ id: uid(), kind: "note", subject, name: title.trim() || text.trim().slice(0, 30), type: "text/plain", size: text.length, date: Date.now(), text: text.trim() });
            setTitle(""); setText(""); setMsg("Note saved."); await load();
          }} data-testid="vault-save-note">Save note</Button>
        </div>
        {msg && <p className="text-sm text-muted" data-testid="vault-msg">{msg}</p>}
        <p className="text-xs text-faint">{items?.length ?? 0} item{items?.length === 1 ? "" : "s"} · {size(total)} on this device{idb.blocked ? ". This browser blocks storage, so they'll be lost when you close the page." : "."} Clearing your browser&apos;s site data deletes them.</p>
      </Card>

      <div className="space-y-3">
        {used.length > 1 && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {["all", ...used].map((k) => <button key={k} type="button" onClick={() => setFilter(k)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium", filter === k ? "border-primary/30 bg-primary-soft text-primary" : "border-border text-muted hover:text-text")}>{k === "all" ? "All subjects" : k}</button>)}
          </div>
        )}
        {items && list.length === 0 && <Card><EmptyState icon={<FileText className="size-5" />} title="Nothing here yet" description="Add a file, a photo or a note. They stay on this device." /></Card>}
        <ul className="space-y-2" data-testid="vault-list">
          {list.map((x) => (
            <li key={x.id} className="flex gap-3 rounded-xl border border-border bg-surface p-3" data-testid="vault-item">
              {/^image\//.test(x.type) && urls[x.id]
                // eslint-disable-next-line @next/next/no-img-element -- a local object URL
                ? <img src={urls[x.id]} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                : <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-surface-2 text-faint">{x.kind === "note" ? <NotebookPen className="size-5" /> : <FileText className="size-5" />}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{x.name}</p>
                <p className="text-xs text-muted">{x.subject} · {x.kind === "note" ? "note" : size(x.size)} · {new Date(x.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                {x.kind === "note" && x.text && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{x.text}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {urls[x.id] && <a href={urls[x.id]} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"><ExternalLink className="size-3.5" /> Open</a>}
                  {urls[x.id] && <a href={urls[x.id]} download={x.name} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"><Download className="size-3.5" /> Save</a>}
                  {x.kind === "note" && x.text && <ReadAloud text={`${x.name}. ${x.text}`} />}
                  <button type="button" onClick={async () => { await idb.del(x.id); await load(); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-3.5" /> Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
