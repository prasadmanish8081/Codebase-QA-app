"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Snippet = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  code: string;
  score: number;
  sourceUrl?: string;
};

type HistoryItem = {
  id: string;
  createdAt: string;
  question: string;
  answer: string;
  repoLabel: string;
  snippets: Snippet[];
};

type ApiError = { error: string };

type IngestResponse = {
  ok: true;
  sourceType: "github" | "zip";
  sourceLabel: string;
  fileCount: number;
};

type AskResponse = {
  answer: string;
  snippets: Snippet[];
  createdAt: string;
  repoLabel: string;
};

type HistoryResponse = {
  items: HistoryItem[];
  count: number;
};

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as T | ApiError;
    if (!res.ok) {
      const err = data as ApiError;
      throw new Error(err.error || "Request failed");
    }
    return data as T;
  }

  const raw = await res.text();
  const preview = raw.replace(/\s+/g, " ").slice(0, 160);
  throw new Error(`Server returned non-JSON response (${res.status}): ${preview}`);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export default function HomePage() {
  const [githubUrl, setGithubUrl] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [loadingIngest, setLoadingIngest] = useState(false);
  const [loadingAsk, setLoadingAsk] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeRepo, setActiveRepo] = useState("");

  const canSubmitIngest = useMemo(() => Boolean(githubUrl.trim() || zipFile), [githubUrl, zipFile]);

  async function loadHistory() {
    const res = await fetch("/api/history", { cache: "no-store" });
    const data = await parseJson<HistoryResponse>(res);
    setHistory(data.items || []);
  }

  useEffect(() => {
    loadHistory().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load history");
    });
  }, []);

  async function onIngest(e: FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("");
    setLoadingIngest(true);

    try {
      if (!canSubmitIngest) {
        throw new Error("Add a GitHub URL or upload a zip file.");
      }

      const form = new FormData();
      form.append("githubUrl", githubUrl.trim());
      if (zipFile) form.append("zipFile", zipFile);

      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await parseJson<IngestResponse>(res);

      setActiveRepo(data.sourceLabel);
      setStatus(`Loaded ${data.fileCount} files from ${data.sourceLabel}`);
      setQuestion("");
      setAnswer("");
      setSnippets([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setLoadingIngest(false);
    }
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoadingAsk(true);

    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await parseJson<AskResponse>(res);

      setAnswer(data.answer || "");
      setSnippets(data.snippets || []);
      setActiveRepo(data.repoLabel || activeRepo);
      await loadHistory().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Q&A failed");
    } finally {
      setLoadingAsk(false);
    }
  }

  async function onClearHistory() {
    if (!history.length) return;
    const ok = window.confirm("Last 10 Q&A history clear karna hai?");
    if (!ok) return;

    setError("");
    setClearingHistory(true);
    try {
      const res = await fetch("/api/history", { method: "DELETE" });
      await parseJson<{ ok: boolean }>(res);
      setHistory([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear history");
    } finally {
      setClearingHistory(false);
    }
  }

  return (
    <div className="grid page-gap-lg">
      <section className="card">
        <div className="row spread">
          <div className="grid page-gap-xs">
            <h1>Codebase Q&A with Proof</h1>
            <p>1) load repository, 2) ask question, 3) verify with file evidence.</p>
            {activeRepo ? <span className="badge">Active repo: {activeRepo}</span> : null}
          </div>
          <Link href="/status">Status Page</Link>
        </div>
      </section>

      <section className="grid grid-2">
        <form className="card grid" onSubmit={onIngest}>
          <h2>Step 1: Load Codebase</h2>
          <label htmlFor="githubUrl">Public GitHub URL</label>
          <input
            id="githubUrl"
            placeholder="https://github.com/owner/repo or /tree/branch"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
          />

          <label htmlFor="zipFile">Or upload .zip (max 15MB)</label>
          <input
            id="zipFile"
            type="file"
            accept=".zip"
            onChange={(e) => setZipFile(e.target.files?.[0] || null)}
          />

          <button disabled={loadingIngest || !canSubmitIngest} type="submit">
            {loadingIngest ? "Loading..." : "Load Codebase"}
          </button>
          {status ? <span className="badge">{status}</span> : null}
        </form>

        <form className="card grid" onSubmit={onAsk}>
          <h2>Step 2: Ask a Question</h2>
          <textarea
            placeholder="Where is auth handled? How do retries work?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
          />
          <button disabled={loadingAsk} type="submit">
            {loadingAsk ? "Thinking..." : "Ask"}
          </button>
          <p>{question.length}/500 chars</p>
          {error ? <div className="error">{error}</div> : null}
        </form>
      </section>

      <section className="card grid">
        <h2>Answer</h2>
        <p>{answer || "No answer yet."}</p>
        {!!snippets.length && <h3>Retrieved Snippets</h3>}
        {snippets.map((s) => (
          <article key={s.id} id={s.id} className="grid snippet-card">
            <div className="snippet-title">
              {s.id} - {s.path}:{s.startLine}-{s.endLine}
            </div>
            {s.sourceUrl ? (
              <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                Open source file
              </a>
            ) : (
              <p>ZIP source hai, isliye public file link available nahi hai.</p>
            )}
            <pre>{s.code}</pre>
          </article>
        ))}
      </section>

      <section className="card grid">
        <div className="row spread wrap">
          <h2>Last 10 Q&As</h2>
          <button
            type="button"
            className="danger-btn"
            onClick={onClearHistory}
            disabled={clearingHistory || !history.length}
          >
            {clearingHistory ? "Clearing..." : "Clear History"}
          </button>
        </div>
        {!history.length && <p>No history yet.</p>}
        {history.map((item) => (
          <article key={item.id} className="grid qa-item">
            <div className="row spread wrap">
              <strong>{item.question}</strong>
              <span>{formatTime(item.createdAt)}</span>
            </div>
            <span className="badge">{item.repoLabel}</span>
            <p>{item.answer}</p>
            <div className="row wrap">
              {item.snippets.map((s) => (
                <a key={`${item.id}-${s.id}`} href={s.sourceUrl || `#${s.id}`} target={s.sourceUrl ? "_blank" : undefined} rel={s.sourceUrl ? "noreferrer" : undefined}>
                  {s.path}:{s.startLine}-{s.endLine}
                </a>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
