"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  FileText,
  GitBranch,
  Link2,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Repository = {
  id: string;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id: string } | null;
  pushed_at: string;
};

const STORAGE_KEY = "github-repository-library:v1";
const GITHUB_REPOSITORY_PATTERN = /https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)/gi;

function extractRepositories(text: string) {
  const found = new Map<string, string>();

  for (const match of text.matchAll(GITHUB_REPOSITORY_PATTERN)) {
    const owner = match[1];
    const repository = match[2].replace(/\.git$/i, "").replace(/[.,;:!?]+$/, "");
    if (owner && repository && !["settings", "topics", "orgs", "users"].includes(repository.toLowerCase())) {
      const fullName = `${owner}/${repository}`;
      found.set(fullName.toLowerCase(), fullName);
    }
  }

  return [...found.values()];
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function makeOneNoteHtml(repositories: Repository[]) {
  const rows = repositories.map((repository) => `
    <tr>
      <td><a href="${repository.html_url}">${repository.full_name}</a></td>
      <td>${repository.description ?? "No description provided."}</td>
      <td>${repository.language ?? "Not specified"}</td>
      <td>${repository.stargazers_count.toLocaleString()}</td>
      <td>${repository.license?.spdx_id ?? "Not specified"}</td>
      <td>${new Date(repository.pushed_at).toLocaleDateString()}</td>
    </tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>GitHub Repository Library</title></head><body>
    <h1>GitHub Repository Library</h1>
    <p>Exported ${new Date().toLocaleString()} · ${repositories.length} repositories</p>
    <table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Repository</th><th>Description</th><th>Language</th><th>Stars</th><th>License</th><th>Last updated</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

function downloadPdf(repositories: Repository[]) {
  const document = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  document.setFont("helvetica", "bold");
  document.setFontSize(20);
  document.text("GitHub Repository Library", 38, 42);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.setTextColor(90);
  document.text(`${repositories.length} repositories · Updated ${new Date().toLocaleString()}`, 38, 60);
  autoTable(document, {
    startY: 76,
    head: [["Repository", "Description", "Language", "Stars", "Forks", "Open issues", "License"]],
    body: repositories.map((repository) => [
      repository.full_name,
      repository.description ?? "No description provided.",
      repository.language ?? "—",
      formatCount(repository.stargazers_count),
      formatCount(repository.forks_count),
      formatCount(repository.open_issues_count),
      repository.license?.spdx_id ?? "—",
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 6, overflow: "linebreak" },
    headStyles: { fillColor: [25, 91, 72], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [241, 246, 243] },
    columnStyles: { 0: { cellWidth: 128 }, 1: { cellWidth: 300 } },
    margin: { left: 38, right: 38 },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const repository = repositories[data.row.index];
        if (repository) document.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: repository.html_url });
      }
    },
  });
  document.save("github-repository-library.pdf");
}

export default function Home() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let loadedRepositories: Repository[] = [];
    let loadMessage = "";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) loadedRepositories = JSON.parse(saved) as Repository[];
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      loadMessage = "Saved list could not be read and has been reset.";
    }
    const frame = window.requestAnimationFrame(() => {
      setRepositories(loadedRepositories);
      if (loadMessage) setMessage(loadMessage);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repositories));
  }, [hydrated, repositories]);

  const visibleRepositories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return repositories;
    return repositories.filter((repository) =>
      `${repository.full_name} ${repository.description ?? ""} ${repository.language ?? ""}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query, repositories]);

  const totalStars = useMemo(() => repositories.reduce((total, repository) => total + repository.stargazers_count, 0), [repositories]);
  const languages = useMemo(() => new Set(repositories.map((repository) => repository.language).filter(Boolean)).size, [repositories]);

  async function addRepositories(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullNames = extractRepositories(input);
    if (fullNames.length === 0) {
      setMessage("Paste a GitHub repository link, or text that contains one.");
      return;
    }

    const known = new Set(repositories.map((repository) => repository.full_name.toLowerCase()));
    const newNames = fullNames.filter((fullName) => !known.has(fullName.toLowerCase()));
    if (newNames.length === 0) {
      setMessage("Those repositories are already in your library.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    const results = await Promise.allSettled(newNames.map(async (fullName) => {
      const response = await fetch(`https://api.github.com/repos/${fullName}`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) throw new Error(`${fullName}: ${response.status === 404 ? "repository not found or private" : `GitHub returned ${response.status}`}`);
      return await response.json() as Repository;
    }));

    const added = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "Could not load repository."] : []);
    if (added.length) {
      setRepositories((current) => [...added, ...current].sort((left, right) => right.pushed_at.localeCompare(left.pushed_at)));
      setInput("");
    }
    setMessage(`${added.length ? `Added ${added.length} ${added.length === 1 ? "repository" : "repositories"}.` : "No repositories were added."}${errors.length ? ` ${errors.join(" · ")}` : " PDF and exports are up to date."}`);
    setIsLoading(false);
  }

  function removeRepository(id: string) {
    setRepositories((current) => current.filter((repository) => repository.id !== id));
    setMessage("Repository removed. PDF and exports are up to date.");
  }

  function downloadOneNoteFile() {
    const blob = new Blob([makeOneNoteHtml(repositories)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "github-repository-library-onenote.html";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Repository Library home">
          <span className="brand-mark"><GitBranch size={19} strokeWidth={2.2} /></span>
          <span>REPO<span className="brand-light">SHELF</span></span>
        </a>
        <div className="topbar-right"><span className="sync-status"><span className="status-dot" /> Saved in this browser</span><a className="help-link" href="#about"><CircleHelp size={16} /> About exports</a></div>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <p className="eyebrow"><Sparkles size={13} /> YOUR OPEN-SOURCE COLLECTION</p>
          <h1>Good repos,<br /><span>kept close.</span></h1>
          <p className="intro-description">Collect GitHub projects from links you find. Paste once; keep the useful details and exports together.</p>
        </div>
        <div className="intro-aside"><span className="aside-number">01</span><span className="aside-rule" /><p>A personal index<br />for things worth building with.</p></div>
      </section>

      <section className="workspace">
        <div className="capture-panel">
          <div className="section-heading"><div><span className="step-index">01 / COLLECT</span><h2>Add repository links</h2></div><span className="heading-icon"><Link2 size={18} /></span></div>
          <form onSubmit={addRepositories}>
            <label className="sr-only" htmlFor="repo-links">GitHub links or text containing GitHub links</label>
            <textarea id="repo-links" value={input} onChange={(event) => setInput(event.target.value)} placeholder={'Paste a GitHub link or a block of text containing links…\n\nhttps://github.com/owner/repository'} rows={3} />
            <div className="form-footer"><span className="input-hint">Multiple repository links are picked up automatically.</span><button className="primary-button" type="submit" disabled={isLoading || !input.trim()}>{isLoading ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}{isLoading ? "Fetching" : "Add to library"}</button></div>
          </form>
          {message && <p className="feedback" role="status">{message}</p>}
        </div>

        <div className="library-toolbar">
          <div className="library-title"><span className="step-index">02 / LIBRARY</span><h2>Your repositories <span className="repo-count">{repositories.length.toString().padStart(2, "0")}</span></h2></div>
          <div className="toolbar-actions">
            <label className="search-field"><Search size={15} /><span className="sr-only">Filter repositories</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter library" /></label>
            <button className="export-button" type="button" onClick={() => downloadPdf(repositories)} disabled={!repositories.length}><ArrowDownToLine size={15} /> PDF</button>
            <button className="export-button secondary-export" type="button" onClick={downloadOneNoteFile} disabled={!repositories.length}><BookOpen size={15} /> OneNote</button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat"><span className="stat-label">PROJECTS</span><strong>{repositories.length}</strong><span className="stat-note">in your library</span></div>
          <div className="stat"><span className="stat-label">COLLECTIVE STARS</span><strong>{formatCount(totalStars)}</strong><span className="stat-note">across saved repos</span></div>
          <div className="stat"><span className="stat-label">LANGUAGES</span><strong>{languages}</strong><span className="stat-note">represented</span></div>
          <div className="stat-export"><FileText size={17} /><span>Exports follow your collection automatically</span></div>
        </div>

        <div className="repository-list" aria-live="polite">
          <div className="list-head"><span>REPOSITORY</span><span>LANGUAGE</span><span>STARS</span><span>UPDATED</span><span /></div>
          {visibleRepositories.map((repository) => (
            <article className="repository-row" key={repository.id}>
              <div className="repository-main"><a className="repository-name" href={repository.html_url} target="_blank" rel="noreferrer">{repository.full_name}<ArrowUpRight size={13} /></a><p>{repository.description || "No description provided by the repository owner."}</p><span className="license-tag">{repository.license?.spdx_id ?? "License not specified"}</span></div>
              <div className="row-language">{repository.language ? <><span className="language-dot" />{repository.language}</> : <span className="muted">—</span>}</div>
              <div className="row-stars"><Star size={13} />{formatCount(repository.stargazers_count)}</div>
              <div className="row-updated">{new Date(repository.pushed_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</div>
              <button className="icon-button remove-button" type="button" onClick={() => removeRepository(repository.id)} aria-label={`Remove ${repository.full_name}`} title="Remove repository"><Trash2 size={15} /></button>
            </article>
          ))}
          {visibleRepositories.length === 0 && <div className="empty-state"><span className="empty-mark"><GitBranch size={22} /></span><h3>{repositories.length ? "No matching repositories" : "Your shelf is ready"}</h3><p>{repositories.length ? "Try a different name, description, or language." : "Add a GitHub link above to start your collection."}</p></div>}
        </div>
      </section>

      <footer className="footer" id="about"><span>REPOSHELF <span className="footer-separator">/</span> PRIVATE BY DEFAULT</span><p><span><FileText size={13} /> PDF updates with your list</span><span><BookOpen size={13} /> HTML opens in OneNote</span><span>Saved locally in this browser</span></p></footer>
    </main>
  );
}
