"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Check = { ok: boolean; detail: string };

type Health = {
  backend: Check;
  database: Check;
  llm: Check;
  checkedAt?: string;
};

export default function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      const data = (await response.json()) as Health | { error: string };
      if (!response.ok) {
        throw new Error((data as { error: string }).error || "Failed to load status");
      }
      setHealth(data as Health);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus().catch(() => undefined);
  }, []);

  function cell(name: string, value?: Check) {
    return (
      <article className="card grid page-gap-xs">
        <h3>{name}</h3>
        <strong style={{ color: value?.ok ? "#0f766e" : "#b42318" }}>{value?.ok ? "Healthy" : "Unhealthy"}</strong>
        <p>{value?.detail || "..."}</p>
      </article>
    );
  }

  return (
    <div className="grid page-gap-md">
      <section className="card row spread">
        <div>
          <h1>System Status</h1>
          <p>Backend, database, and LLM connection checks.</p>
          {health?.checkedAt ? <p>Last check: {new Date(health.checkedAt).toLocaleString()}</p> : null}
        </div>
        <div className="row wrap">
          <button type="button" onClick={() => loadStatus()} disabled={loading}>
            {loading ? "Checking..." : "Refresh"}
          </button>
          <Link href="/">Home</Link>
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="grid grid-2">
        {cell("Backend", health?.backend)}
        {cell("Database", health?.database)}
        {cell("LLM", health?.llm)}
      </section>
    </div>
  );
}
