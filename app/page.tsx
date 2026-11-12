"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ArrowUpRight, Check, Code2, LogOut, Pencil, Plus, Search, Trash2, X } from "lucide-react";

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

type RepoForm = { github_url: string };
type RepoEditForm = { project_name: string; description: string; github_url: string; technology: string; tags: string; stars: string };
const emptyForm: RepoForm = { github_url: "" };
type GitHubRepository = { name: string; full_name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; topics?: string[]; archived: boolean };

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RepoEditForm | null>(null);
  const [updating, setUpdating] = useState(false);

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
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const parsedUrl = new URL(form.github_url.trim());
      const parts = parsedUrl.pathname.split("/").filter(Boolean);
      if (parsedUrl.hostname.toLowerCase() !== "github.com" || parts.length < 2) {
        throw new Error("Enter a repository URL in this format: https://github.com/owner/repository");
      }

      const [ownerName, repositoryName] = parts;
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(ownerName)}/${encodeURIComponent(repositoryName.replace(/\.git$/i, ""))}`;
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
      });

      if (response.status === 404) {
        throw new Error("Repository not found. Check the link and make sure the repository is public.");
      }
      if (response.status === 403 || response.status === 429) {
        throw new Error("GitHub API rate limit reached. Please wait a little and try again.");
      }
      if (!response.ok) throw new Error(`GitHub could not retrieve this repository (HTTP ${response.status}).`);

      const repository = await response.json() as GitHubRepository;
      const topics = repository.topics ?? [];
      const topicText = topics.join(" ").toLowerCase();
      const category = /machine-learning|artificial-intelligence|llm|deep-learning|ai/.test(topicText)
        ? "AI & Machine Learning"
        : /automation|workflow|bot|rpa/.test(topicText)
          ? "Automation"
          : /data|analytics|visualization|database/.test(topicText)
            ? "Data & Analytics"
            : /engineering|mining|process|simulation/.test(topicText)
              ? "Engineering"
              : /knowledge-management|documentation|wiki/.test(topicText)
                ? "Knowledge Management"
                : /productivity|tools|developer-tools/.test(topicText)
                  ? "Productivity"
                  : "Web Development";

      const payload = {
        project_name: repository.full_name || repository.name,
        description: repository.description ?? "",
        category,
        github_url: repository.html_url,
        technology: repository.language,
        tags: topics,
        status: repository.archived ? "Archived" : "Active",
        stars: repository.stargazers_count ?? 0,
        owner: session.user.id
      };

      const { error: insertError } = await db().from("repositories").insert(payload);
      if (insertError) throw insertError;

      setForm(emptyForm);
      await loadRepos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add this repository.");
    } finally {
      setSaving(false);
    }
  }
  function startEditing(repo: Repo) {
    setError("");
    setEditingId(repo.id);
    setEditForm({
      project_name: repo.project_name,
      description: repo.description ?? "",
      github_url: repo.github_url,
      technology: repo.technology ?? "",
      tags: (repo.tags ?? []).join(", "),
      stars: String(repo.stars ?? 0)
    });
  }
  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }
  async function updateRepo(event: FormEvent, id: string) {
    event.preventDefault();
    if (!editForm) return;
    setUpdating(true);
    setError("");
    const stars = Number(editForm.stars);
    if (!Number.isInteger(stars) || stars < 0) {
      setError("Stars must be a whole number greater than or equal to zero.");
      setUpdating(false);
      return;
    }
    try {
      const { data, error: updateError } = await db().from("repositories").update({
        project_name: editForm.project_name.trim(),
        description: editForm.description.trim(),
        github_url: editForm.github_url.trim(),
        technology: editForm.technology.trim() || null,
        tags: editForm.tags.split(",").map(tag => tag.trim()).filter(Boolean),
        stars
      }).eq("id", id).select().single();
      if (updateError) throw updateError;
      setRepos(current => current.map(repo => repo.id === id ? data as Repo : repo));
      cancelEditing();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this repository.");
    } finally {
      setUpdating(false);
    }
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
    <div className="brand"><span className="brand-icon"><Code2 size={22}/></span><span>REPO<span>SHELF</span></span></div>
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
    <header className="topbar"><a className="brand" href="#"><span className="brand-icon"><Code2 size={21}/></span><span>REPO<span>SHELF</span></span></a><div className="user-area"><span>{session.user.email}</span><button className="icon-btn" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div></header>
    <section className="collect-section">
      <div className="collect-title">
        <div><p className="eyebrow">01 / COLLECT</p><h2>Add repository</h2></div>
        <span className="collect-plus"><Plus size={17}/></span>
      </div>
      <form onSubmit={saveRepo} className="collect-form">
        <label>GITHUB REPOSITORY URL <span>*</span>
          <input required type="url" value={form.github_url} onChange={e=>setForm({github_url:e.target.value})} placeholder="https://github.com/owner/repository"/>
        </label>
        {error && <p className="error collect-error">{error}</p>}
        <div className="collect-actions"><button className="primary" disabled={saving}><Plus size={16}/>{saving ? "Fetching repository…" : "Add to library"}</button></div>
      </form>
    </section>
    <section className="library-heading">
      <div>
        <p className="eyebrow">02 / LIBRARY</p>
        <h1>Your repositories <span className="count">{repos.length}</span></h1>
      </div>
      <div className="library-toolbar">
        <label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter library"/></label>
      </div>
    </section>
    <section className="library-stats">
      <div className="stat-card"><span className="stat-icon"><Code2 size={17}/></span><div><span>PROJECTS</span><strong>{repos.length}</strong><small>repositories collected</small></div></div>
      <div className="stat-card"><span className="stat-icon star-icon">★</span><div><span>COLLECTIVE STARS</span><strong>{repos.reduce((sum, repo) => sum + (repo.stars || 0), 0).toLocaleString()}</strong><small>across your collection</small></div></div>
      <div className="stat-card"><span className="stat-icon"><Search size={17}/></span><div><span>CATEGORIES</span><strong>{new Set(repos.map(repo => repo.category)).size}</strong><small>areas represented</small></div></div>
    </section>
    <section className="library-table-wrap">
      {error && <p className="error inline-error">{error}</p>}
      {loading ? <div className="empty">Loading your repositories…</div> : filtered.length === 0 ? <div className="empty"><Code2 size={30}/><strong>{repos.length ? "No matching repositories" : "Your library is empty"}</strong><span>{repos.length ? "Try another search term." : "Add a GitHub URL to automatically import its details."}</span></div> :
      <div className="library-table-scroll">
        <table className="library-table">
          <thead><tr><th>REPOSITORY NAME</th><th>DESCRIPTION</th><th>GITHUB URL</th><th>PROGRAMMING LANGUAGE</th><th>TOPICS / TAGS</th><th>STARS</th><th aria-label="Actions"></th></tr></thead>
          <tbody>{filtered.map(repo=><tr key={repo.id} className={editingId === repo.id ? "editing-row" : ""}>
            {editingId === repo.id && editForm ? <>
              <td><input className="cell-edit" aria-label="Repository name" value={editForm.project_name} onChange={e=>setEditForm({...editForm,project_name:e.target.value})}/></td>
              <td><textarea className="cell-edit cell-edit-description" aria-label="Description" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})}/></td>
              <td><input className="cell-edit" aria-label="GitHub URL" type="url" value={editForm.github_url} onChange={e=>setEditForm({...editForm,github_url:e.target.value})}/></td>
              <td><input className="cell-edit" aria-label="Programming language" value={editForm.technology} onChange={e=>setEditForm({...editForm,technology:e.target.value})}/></td>
              <td><input className="cell-edit" aria-label="Topics, comma separated" value={editForm.tags} onChange={e=>setEditForm({...editForm,tags:e.target.value})}/></td>
              <td><input className="cell-edit cell-edit-number" aria-label="Stars" type="number" min="0" step="1" value={editForm.stars} onChange={e=>setEditForm({...editForm,stars:e.target.value})}/></td>
              <td className="row-actions"><button className="icon-btn save-edit" onClick={e=>void updateRepo(e,repo.id)} disabled={updating} title="Save changes"><Check size={16}/></button><button className="icon-btn" onClick={cancelEditing} disabled={updating} title="Cancel editing"><X size={16}/></button></td>
            </> : <>
              <td className="table-repository"><strong>{repo.project_name}</strong></td>
              <td className="table-description">{repo.description || "—"}</td>
              <td><a href={repo.github_url} target="_blank" rel="noreferrer" className="repo-name table-url">Open repository <ArrowUpRight size={13}/></a></td>
              <td>{repo.technology || "—"}</td>
              <td><div className="table-tags">{repo.tags && repo.tags.length > 0 ? repo.tags.map(tag=><span key={tag}>{tag}</span>) : "—"}</div></td>
              <td className="table-stars">★ {repo.stars.toLocaleString()}</td>
              <td className="row-actions"><button className="icon-btn" onClick={()=>startEditing(repo)} title="Edit repository"><Pencil size={15}/></button><button className="icon-btn danger" onClick={()=>void removeRepo(repo.id)} title="Remove from library"><Trash2 size={15}/></button></td>
            </>}
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    <footer>REPOSHELF <span>·</span> PRIVATE BY DEFAULT</footer>

  </main>;
}
