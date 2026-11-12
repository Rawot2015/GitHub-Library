"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ArrowUpRight, BookOpen, Check, Code2, Folder, FolderPlus, LogOut, Pencil, Plus, Search, SlidersHorizontal, Star, Trash2, X } from "lucide-react";

type Repo = {
  id: string;
  collection_id: string | null;
  notes: string | null;
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

type Collection = { id: string; name: string; created_at: string };
type GitHubDetails = { name?: string; full_name?: string; description?: string | null; html_url?: string; language?: string | null; stargazers_count?: number; forks_count?: number; open_issues_count?: number; created_at?: string; updated_at?: string; default_branch?: string; topics?: string[]; license?: { name?: string } | null };
type RepoForm = { github_url: string };
type RepoEditForm = { project_name: string; description: string; github_url: string; technology: string; tags: string; stars: string; collection_id: string };
const emptyForm: RepoForm = { github_url: "" };
type GitHubRepository = { name: string; full_name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; topics?: string[]; archived: boolean };

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [activeCollection, setActiveCollection] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [detailRepo, setDetailRepo] = useState<Repo | null>(null);
  const [detailData, setDetailData] = useState<GitHubDetails | null>(null);
  const [readme, setReadme] = useState("");
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailNotes, setDetailNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
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
    const [{ data, error: e }, { data: collectionData, error: collectionError }] = await Promise.all([
      db().from("repositories").select("*").order("updated_at", { ascending: false }),
      db().from("collections").select("id,name,created_at").order("name", { ascending: true })
    ]);
    if (e) setError(e.message); else setRepos((data ?? []) as Repo[]);
    if (collectionError) setError(collectionError.message); else setCollections((collectionData ?? []) as Collection[]);
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
        owner: session.user.id,
        collection_id: null,
        notes: ""
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
      stars: String(repo.stars ?? 0),
      collection_id: repo.collection_id ?? ""
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
        stars,
        collection_id: editForm.collection_id || null
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

  const languages = useMemo(() => Array.from(new Set(repos.map(repo => repo.technology).filter((value): value is string => Boolean(value)))).sort(), [repos]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const result = repos.filter(r => {
      const matchesQuery = !q || [r.project_name, r.description, r.category, r.technology, ...(r.tags ?? [])].join(" ").toLowerCase().includes(q);
      const matchesTag = !activeTag || (r.tags ?? []).some(tag => tag.toLowerCase() === activeTag.toLowerCase());
      const matchesCollection = activeCollection === "all" || (activeCollection === "unassigned" ? !r.collection_id : r.collection_id === activeCollection);
      const matchesLanguage = languageFilter === "all" || r.technology === languageFilter;
      return matchesQuery && matchesTag && matchesCollection && matchesLanguage;
    });
    return result.sort((a,b) => sortBy === "name" ? a.project_name.localeCompare(b.project_name) : sortBy === "stars" ? b.stars-a.stars : sortBy === "added" ? new Date(b.created_at).getTime()-new Date(a.created_at).getTime() : new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());
  }, [repos, query, activeTag, activeCollection, languageFilter, sortBy]);

  const availableTags = useMemo(() => Array.from(new Set(repos.flatMap(repo => repo.tags ?? []).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [repos]);

  async function createCollection(event: FormEvent) {
    event.preventDefault();
    const name = newCollectionName.trim();
    if (!name) return;
    setCollectionBusy(true); setError("");
    const { data, error: e } = await db().from("collections").insert({ name, owner: session.user.id }).select("id,name,created_at").single();
    if (e) setError(e.message); else { setCollections(current => [...current, data as Collection].sort((a,b)=>a.name.localeCompare(b.name))); setNewCollectionName(""); setActiveCollection(data.id); }
    setCollectionBusy(false);
  }
  async function renameCollection(collection: Collection) {
    const name = prompt("Rename collection", collection.name)?.trim();
    if (!name || name === collection.name) return;
    const { data, error: e } = await db().from("collections").update({ name }).eq("id", collection.id).select("id,name,created_at").single();
    if (e) setError(e.message); else setCollections(current => current.map(item => item.id === collection.id ? data as Collection : item).sort((a,b)=>a.name.localeCompare(b.name)));
  }
  async function deleteCollection(collection: Collection) {
    if (!confirm(`Delete collection “${collection.name}”? Repositories will remain in your library but become unassigned.`)) return;
    const { error: e } = await db().from("collections").delete().eq("id", collection.id);
    if (e) setError(e.message); else { setCollections(current => current.filter(item => item.id !== collection.id)); setRepos(current => current.map(repo => repo.collection_id === collection.id ? {...repo,collection_id:null} : repo)); if (activeCollection === collection.id) setActiveCollection("all"); }
  }
  async function openDetails(repo: Repo) {
    setDetailRepo(repo); setDetailData(null); setReadme(""); setDetailNotes(repo.notes ?? ""); setDetailLoading(true); setReadmeLoading(true);
    try {
      const path = new URL(repo.github_url).pathname.split("/").filter(Boolean);
      const [owner, name] = path;
      const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
      const [metadataResponse, readmeResponse] = await Promise.all([fetch(`https://api.github.com/repos/${owner}/${name}`, {headers}),fetch(`https://api.github.com/repos/${owner}/${name}/readme`, {headers})]);
      if (metadataResponse.ok) setDetailData(await metadataResponse.json() as GitHubDetails);
      if (readmeResponse.ok) { const readmeMeta = await readmeResponse.json(); if (readmeMeta.download_url) { const contentResponse = await fetch(readmeMeta.download_url); if (contentResponse.ok) setReadme(await contentResponse.text()); } }
    } catch { setError("Could not load the latest GitHub details. Your saved repository information is still available."); }
    finally { setDetailLoading(false); setReadmeLoading(false); }
  }
  async function saveNotes() {
    if (!detailRepo) return;
    setNotesSaving(true);
    const { error: e } = await db().from("repositories").update({notes:detailNotes}).eq("id",detailRepo.id);
    if (e) setError(e.message); else { setRepos(current=>current.map(repo=>repo.id===detailRepo.id?{...repo,notes:detailNotes}:repo)); setDetailRepo(current=>current?{...current,notes:detailNotes}:current); }
    setNotesSaving(false);
  }

  if (!authReady) return <main className="screen-center">Loading RepoShelf…</main>;
  if (!session) return <main className="login-wrap"><section className="login-card">
    <div className="brand"><span className="brand-icon"><img src="/reposhelf-mark.svg" alt="" /></span><span>REPO<span>SHELF</span></span></div>
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
    <header className="topbar"><a className="brand" href="#"><span className="brand-icon"><img src="/reposhelf-mark.svg" alt="" /></span><span>REPO<span>SHELF</span></span></a><div className="user-area"><span>{session.user.email}</span><button className="icon-btn" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div></header>
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
        <label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search repositories"/></label>
      </div>
    </section>
    <section className="collections-panel">
      <div className="collections-topline"><div><Folder size={17}/><strong>Collections</strong><span>Organize your repository library</span></div><form onSubmit={createCollection}><input value={newCollectionName} onChange={e=>setNewCollectionName(e.target.value)} placeholder="New collection name" aria-label="New collection name"/><button className="primary" disabled={collectionBusy || !newCollectionName.trim()}><FolderPlus size={15}/>Create</button></form></div>
      <div className="collection-chips"><button className={activeCollection === "all" ? "active" : ""} onClick={()=>setActiveCollection("all")}>All repositories <b>{repos.length}</b></button>{collections.map(collection=><div className={`collection-chip ${activeCollection===collection.id?"active":""}`} key={collection.id}><button onClick={()=>setActiveCollection(collection.id)}>{collection.name}<b>{repos.filter(repo=>repo.collection_id===collection.id).length}</b></button><button className="collection-manage" title={`Rename ${collection.name}`} onClick={()=>void renameCollection(collection)}><Pencil size={12}/></button><button className="collection-manage" title={`Delete ${collection.name}`} onClick={()=>void deleteCollection(collection)}><X size={13}/></button></div>)}<button className={activeCollection === "unassigned" ? "active" : ""} onClick={()=>setActiveCollection("unassigned")}>Unassigned <b>{repos.filter(repo=>!repo.collection_id).length}</b></button></div>
    </section>
    <section className="advanced-filters">
      <div className="filter-title"><SlidersHorizontal size={15}/><span>FILTER & SORT</span></div>
      <label>LANGUAGE<select value={languageFilter} onChange={e=>setLanguageFilter(e.target.value)}><option value="all">All languages</option>{languages.map(language=><option key={language}>{language}</option>)}</select></label>
      <label>SORT BY<select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="updated">Recently updated</option><option value="added">Recently added</option><option value="stars">Most stars</option><option value="name">Name (A–Z)</option></select></label>
      <button className="reset-filters" onClick={()=>{setQuery("");setActiveTag(null);setActiveCollection("all");setLanguageFilter("all");setSortBy("updated");}}>Reset filters</button>
    </section>
    <section className="tag-filter-section" aria-label="Filter repositories by topic">
      <div className="tag-filter-heading"><span>FILTER BY TAG</span>{activeTag && <button className="clear-tag-filter" onClick={() => setActiveTag(null)}>Clear “{activeTag}” <X size={12}/></button>}</div>
      <div className="tag-filter-list">
        {availableTags.length ? availableTags.map(tag => <button key={tag} type="button" className={`tag-filter-chip ${activeTag === tag ? "selected" : ""}`} aria-pressed={activeTag === tag} onClick={() => setActiveTag(current => current === tag ? null : tag)}>{tag}<span>{repos.filter(repo => (repo.tags ?? []).some(item => item.toLowerCase() === tag.toLowerCase())).length}</span></button>) : <span className="no-tags">No GitHub topics available yet. Add or edit repository tags to build filters.</span>}
      </div>
    </section>
    <section className="library-table-wrap">
      {error && <p className="error inline-error">{error}</p>}
      {loading ? <div className="empty">Loading your repositories…</div> : filtered.length === 0 ? <div className="empty"><Code2 size={30}/><strong>{repos.length ? "No matching repositories" : "Your library is empty"}</strong><span>{repos.length ? (activeTag ? `No repositories are tagged “${activeTag}”.` : "Try another search term.") : "Add a GitHub URL to automatically import its details."}</span></div> :
      <div className="library-table-scroll">
        <table className="library-table">
          <thead><tr><th>REPOSITORY NAME</th><th>DESCRIPTION</th><th>GITHUB URL</th><th>PROGRAMMING LANGUAGE</th><th>TOPICS / TAGS</th><th>STARS</th><th aria-label="Actions"></th></tr></thead>
          <tbody>{filtered.map(repo=><tr key={repo.id} className={editingId === repo.id ? "editing-row" : ""}>
            {editingId === repo.id && editForm ? <>
              <td><input className="cell-edit" aria-label="Repository name" value={editForm.project_name} onChange={e=>setEditForm({...editForm,project_name:e.target.value})}/></td>
              <td><textarea className="cell-edit cell-edit-description" aria-label="Description" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})}/></td>
              <td><input className="cell-edit" aria-label="GitHub URL" type="url" value={editForm.github_url} onChange={e=>setEditForm({...editForm,github_url:e.target.value})}/></td>
              <td><input className="cell-edit" aria-label="Programming language" value={editForm.technology} onChange={e=>setEditForm({...editForm,technology:e.target.value})}/></td>
              <td><input className="cell-edit" aria-label="Topics, comma separated" value={editForm.tags} onChange={e=>setEditForm({...editForm,tags:e.target.value})}/><select className="cell-edit collection-cell-select" aria-label="Collection" value={editForm.collection_id} onChange={e=>setEditForm({...editForm,collection_id:e.target.value})}><option value="">No collection</option>{collections.map(collection=><option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></td>
              <td><input className="cell-edit cell-edit-number" aria-label="Stars" type="number" min="0" step="1" value={editForm.stars} onChange={e=>setEditForm({...editForm,stars:e.target.value})}/></td>
              <td className="row-actions"><button className="icon-btn save-edit" onClick={e=>void updateRepo(e,repo.id)} disabled={updating} title="Save changes"><Check size={16}/></button><button className="icon-btn" onClick={cancelEditing} disabled={updating} title="Cancel editing"><X size={16}/></button></td>
            </> : <>
              <td className="table-repository"><button className="repo-detail-link" onClick={()=>void openDetails(repo)}>{repo.project_name}</button><small className="repo-collection-label">{collections.find(item=>item.id===repo.collection_id)?.name ?? "Unassigned"}</small></td>
              <td className="table-description"><button className="description-detail-link" onClick={()=>void openDetails(repo)}>{repo.description || "No description — open details"}</button></td>
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
    {detailRepo && <div className="detail-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setDetailRepo(null);}}><section className="detail-panel" role="dialog" aria-modal="true" aria-label={`Repository details for ${detailRepo.project_name}`}><header className="detail-header"><div><p className="eyebrow">REPOSITORY DETAILS</p><h2>{detailRepo.project_name}</h2><a href={detailRepo.github_url} target="_blank" rel="noreferrer" className="repo-name">{detailRepo.github_url} <ArrowUpRight size={14}/></a></div><button className="icon-btn" onClick={()=>setDetailRepo(null)} aria-label="Close details"><X/></button></header>
      <p className="detail-description">{detailData?.description || detailRepo.description || "No description provided."}</p>
      <div className="detail-metrics"><span><Star size={14}/> {(detailData?.stargazers_count ?? detailRepo.stars).toLocaleString()} stars</span><span>{detailData?.language ?? detailRepo.technology ?? "Language unknown"}</span><span>{detailData?.forks_count?.toLocaleString() ?? "—"} forks</span><span>{detailData?.license?.name ?? "License not specified"}</span></div>
      <div className="detail-meta"><span><b>Created</b>{detailData?.created_at ? new Date(detailData.created_at).toLocaleDateString() : new Date(detailRepo.created_at).toLocaleDateString()}</span><span><b>Last updated</b>{detailData?.updated_at ? new Date(detailData.updated_at).toLocaleDateString() : new Date(detailRepo.updated_at).toLocaleDateString()}</span><span><b>Default branch</b>{detailData?.default_branch ?? "—"}</span></div>
      <div className="detail-topics">{(detailData?.topics ?? detailRepo.tags ?? []).map(tag=><button key={tag} onClick={()=>{setActiveTag(tag);setDetailRepo(null);}}>{tag}</button>)}</div>
      <section className="detail-notes"><label htmlFor="repo-personal-notes">PERSONAL NOTES</label><textarea id="repo-personal-notes" value={detailNotes} onChange={e=>setDetailNotes(e.target.value)} placeholder="Why did you save this repository? What should you explore or remember?"/><button className="primary" onClick={()=>void saveNotes()} disabled={notesSaving}>{notesSaving?"Saving…":"Save notes"}</button></section>
      <section className="readme-section"><h3><BookOpen size={16}/> README preview</h3>{readmeLoading||detailLoading?<p className="muted">Loading GitHub information…</p>:readme?<pre>{readme.slice(0,12000)}{readme.length>12000?"\n\n… README preview truncated":""}</pre>:<p className="muted">No README could be loaded for this repository.</p>}</section>
      </section></div>}
  </main>;
}
