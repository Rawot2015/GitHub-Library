"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ArrowUpRight, Github, LogOut, Plus, Search, Trash2, X } from "lucide-react";

type Repo = {
  id: string;
  project_name: string;
  description: string;
  category: string;
  github_url: string;
  technology: string | null;
  tags: string[] | null;
  owner: string | null;
  status: "Active" | "Archived" | "Planned";
  stars: number;
  created_at: string;
  updated_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let supabase: SupabaseClient | null = null;
function db() {
  if (!supabaseUrl || !supabasePublishableKey) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your deployment environment.");
  if (!supabase) supabase = createClient(supabaseUrl, supabasePublishableKey);
  return supabase;
}

type RepoStatus = "Active" | "Archived" | "Planned";

type RepoForm = { project_name: string; description: string; category: string; github_url: string; technology: string; tags: string; status: RepoStatus; stars: string };
const emptyForm: RepoForm = { project_name: "", description: "", category: "Other", github_url: "", technology: "", tags: "", status: "Active", stars: "0" };
const categories = ["AI & Machine Learning", "Automation", "Engineering", "Knowledge Management", "Web Development", "Productivity", "Data & Analytics", "Other"];

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const client = db();
      client.auth.getSession().then(({ data, error: e }) => {
        if (e) setError(e.message);
        setSession(data.session);
        setAuthReady(true);
      }).catch((e) => { setError(e.message); setAuthReady(true); });
      const result = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
      subscription = result.data.subscription;
    } catch (e) { setError(e instanceof Error ? e.message : "Configuration error"); setAuthReady(true); }
    return () => subscription?.unsubscribe();
  }, []);

  async function loadRepos() {
    if (!session) return;
    setLoading(true); setError("");
    const { data, error: e } = await db().from("repositories").select("*").order("updated_at", { ascending: false });
    if (e) setError(e.message); else setRepos((data ?? []) as Repo[]);
    setLoading(false);
  }
  useEffect(() => { if (session) void loadRepos(); else setRepos([]); }, [session]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    const { error: e } = await db().auth.signInWithPassword({ email, password });
    if (e) setError(e.message);
    setLoading(false);
  }
  async function signOut() { await db().auth.signOut(); setRepos([]); }

  async function saveRepo(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const payload = {
      project_name: form.project_name.trim(), description: form.description.trim(), category: form.category,
      github_url: form.github_url.trim(), technology: form.technology.trim() || null,
      tags: form.tags.split(",").map(x => x.trim()).filter(Boolean), status: form.status,
      stars: Math.max(0, Number(form.stars) || 0), owner: session.user.id
    };
    const { error: e } = await db().from("repositories").insert(payload);
    if (e) setError(e.message); else { setModal(false); setForm(emptyForm); await loadRepos(); }
    setSaving(false);
  }
  async function removeRepo(id: string) {
    if (!confirm("Delete this repository record?")) return;
    const { error: e } = await db().from("repositories").delete().eq("id", id);
    if (e) setError(e.message); else setRepos(current => current.filter(r => r.id !== id));
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return repos.filter(r => !q || [r.project_name, r.description, r.category, r.technology, ...(r.tags ?? [])].join(" ").toLowerCase().includes(q));
  }, [repos, query]);

  if (!authReady) return <main className="screen-center">Loading RepoShelf…</main>;
  if (!session) return <main className="login-wrap"><section className="login-card">
    <div className="brand"><span className="brand-icon"><Github size={22}/></span><span>REPO<span>SHELF</span></span></div>
    <p className="eyebrow">PRIVATE REPOSITORY LIBRARY</p><h1>Your projects,<br/><em>in one place.</em></h1>
    <p className="login-copy">Sign in to access your private RepoShelf collection.</p>
    <form onSubmit={signIn} className="login-form">
      <label>Email address<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>
      <button className="primary full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
    </form>
    {error && <p className="error">{error}</p>}
    <p className="small-note">Access is restricted to your authenticated account. Ask your Supabase project administrator (you) to create the initial user.</p>
  </section></main>;

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-icon"><Github size={21}/></span><span>REPO<span>SHELF</span></span></a><div className="user-area"><span>{session.user.email}</span><button className="icon-btn" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div></header>
    <section className="heading"><div><p className="eyebrow">YOUR PRIVATE WORKSPACE</p><h1>My repositories</h1><p className="subheading">A focused home for projects worth keeping.</p></div><button className="primary add-main" onClick={()=>{setForm(emptyForm);setModal(true)}}><Plus size={20}/> Add Repo</button></section>
    <section className="list-panel">
      <div className="list-toolbar"><div><strong>Project list</strong><span className="count">{repos.length}</span></div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects"/></label></div>
      {error && <p className="error inline-error">{error}</p>}
      {loading ? <div className="empty">Loading your repositories…</div> : filtered.length === 0 ? <div className="empty"><Github size={30}/><strong>{repos.length ? "No matching projects" : "Your shelf is empty"}</strong><span>{repos.length ? "Try another search term." : "Add your first repository to get started."}</span></div> :
      <div className="repo-list">{filtered.map(repo=><article className="repo-row" key={repo.id}>
        <div className="repo-info"><a href={repo.github_url} target="_blank" rel="noreferrer" className="repo-name">{repo.project_name}<ArrowUpRight size={14}/></a><p>{repo.description || "No description provided."}</p><div className="meta"><span className="category">{repo.category}</span>{repo.technology && <span>{repo.technology}</span>}{repo.status !== "Active" && <span>{repo.status}</span>}</div></div>
        <div className="repo-actions"><span className="stars">★ {repo.stars}</span><button className="icon-btn danger" onClick={()=>void removeRepo(repo.id)} title="Delete repository"><Trash2 size={16}/></button></div>
      </article>)}</div>}
    </section>
    <footer>REPOSHELF <span>·</span> PRIVATE BY DEFAULT</footer>
    {modal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><section className="modal">
      <div className="modal-head"><div><p className="eyebrow">NEW ENTRY</p><h2>Add repository</h2></div><button className="icon-btn" onClick={()=>setModal(false)}><X size={19}/></button></div>
      <form onSubmit={saveRepo} className="repo-form">
        <label>Project name<input required maxLength={255} value={form.project_name} onChange={e=>setForm({...form,project_name:e.target.value})} placeholder="e.g. Process Flow Simulator"/></label>
        <label>Description<textarea required rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What does this project do?"/></label>
        <div className="form-grid"><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as RepoStatus})}><option>Active</option><option>Planned</option><option>Archived</option></select></label></div>
        <label>GitHub URL<input required type="url" pattern="https://github\\.com/.*" value={form.github_url} onChange={e=>setForm({...form,github_url:e.target.value})} placeholder="https://github.com/owner/repository"/></label>
        <div className="form-grid"><label>Technology<input value={form.technology} onChange={e=>setForm({...form,technology:e.target.value})} placeholder="React, Python…"/></label><label>Stars<input type="number" min="0" value={form.stars} onChange={e=>setForm({...form,stars:e.target.value})}/></label></div>
        <label>Tags <span className="muted">(comma separated)</span><input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="AI, automation, tools"/></label>
        <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setModal(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save repository"}</button></div>
      </form>
    </section></div>}
  </main>;
}
