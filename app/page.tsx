"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ArrowUpRight, Code2, LogOut, Plus, Search, Trash2, X } from "lucide-react";

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
      <div><span>PROJECTS</span><strong>{repos.length}</strong><small>in your library</small></div>
      <div><span>COLLECTIVE STARS</span><strong>{repos.reduce((sum, repo) => sum + (repo.stars || 0), 0).toLocaleString()}</strong><small>from GitHub</small></div>
      <div><span>CATEGORIES</span><strong>{new Set(repos.map(repo => repo.category)).size}</strong><small>represented</small></div>
      <div><span>GITHUB SOURCE</span><strong className="source-status">● Connected metadata</strong><small>fetched automatically from public repositories</small></div>
    </section>
    <section className="library-table-wrap">
      {error && <p className="error inline-error">{error}</p>}
      {loading ? <div className="empty">Loading your repositories…</div> : filtered.length === 0 ? <div className="empty"><Code2 size={30}/><strong>{repos.length ? "No matching repositories" : "Your library is empty"}</strong><span>{repos.length ? "Try another search term." : "Add a GitHub URL to automatically import its details."}</span></div> :
      <div className="library-table-scroll">
        <table className="library-table">
          <thead><tr><th>REPOSITORY NAME</th><th>DESCRIPTION</th><th>GITHUB URL</th><th>PROGRAMMING LANGUAGE</th><th>TOPICS / TAGS</th><th>STARS</th><th>ARCHIVED STATUS</th><th aria-label="Actions"></th></tr></thead>
          <tbody>{filtered.map(repo=><tr key={repo.id}>
            <td className="table-repository"><strong>{repo.project_name}</strong></td>
            <td className="table-description">{repo.description || "—"}</td>
            <td><a href={repo.github_url} target="_blank" rel="noreferrer" className="repo-name table-url">Open repository <ArrowUpRight size={13}/></a></td>
            <td>{repo.technology || "—"}</td>
            <td><div className="table-tags">{repo.tags && repo.tags.length > 0 ? repo.tags.map(tag=><span key={tag}>{tag}</span>) : "—"}</div></td>
            <td className="table-stars">★ {repo.stars.toLocaleString()}</td>
            <td><span className={repo.status === "Archived" ? "archive-pill archived" : "archive-pill"}>{repo.status === "Archived" ? "Yes" : "No"}</span></td>
            <td><button className="icon-btn danger" onClick={()=>void removeRepo(repo.id)} title="Remove from library"><Trash2 size={15}/></button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    <footer>REPOSHELF <span>·</span> PRIVATE BY DEFAULT</footer>

  </main>;
}
