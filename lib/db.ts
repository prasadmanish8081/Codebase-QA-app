import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppState, QARecord, RepoState } from "@/lib/types";

function resolveDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL) return path.join(os.tmpdir(), "codebase-qa-proof");
  return path.join(process.cwd(), "data");
}

const DATA_DIR = resolveDataDir();
const DATA_FILE = path.join(DATA_DIR, "state.json");

const defaultState: AppState = {
  repo: null,
  qas: []
};

let writeLock: Promise<void> = Promise.resolve();

function normalizeRecord(raw: unknown): QARecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as QARecord;
  if (!record.id || !record.question || !record.answer || !record.createdAt) return null;
  if (!Array.isArray(record.snippets)) return null;
  return {
    id: String(record.id),
    createdAt: String(record.createdAt),
    question: String(record.question),
    answer: String(record.answer),
    repoLabel: String(record.repoLabel || "unknown-source"),
    snippets: record.snippets
      .filter((s) => s && typeof s === "object")
      .map((s) => ({
        id: String(s.id),
        path: String(s.path),
        startLine: Number(s.startLine || 0),
        endLine: Number(s.endLine || 0),
        code: String(s.code || ""),
        score: Number(s.score || 0),
        sourceUrl: s.sourceUrl ? String(s.sourceUrl) : undefined
      }))
  };
}

function normalizeState(raw: unknown): AppState {
  if (!raw || typeof raw !== "object") return defaultState;
  const parsed = raw as AppState;

  const normalizedQas = Array.isArray(parsed.qas)
    ? parsed.qas.map((q) => normalizeRecord(q)).filter((q): q is QARecord => q !== null)
    : [];

  const repo = parsed.repo && typeof parsed.repo === "object" ? parsed.repo : null;

  return {
    repo,
    qas: normalizedQas.slice(0, 10)
  };
}

async function ensureDataFile(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(defaultState, null, 2), "utf8");
  }
}

async function atomicWrite(state: AppState): Promise<void> {
  const tmpPath = `${DATA_FILE}.tmp`;
  await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tmpPath, DATA_FILE);
}

export async function readState(): Promise<AppState> {
  await ensureDataFile();
  const raw = await readFile(DATA_FILE, "utf8");
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

export async function writeState(state: AppState): Promise<void> {
  await ensureDataFile();
  writeLock = writeLock.then(() => atomicWrite(normalizeState(state)));
  await writeLock;
}

export async function setRepo(repo: RepoState): Promise<void> {
  const state = await readState();
  await writeState({ ...state, repo });
}

export async function getRepo(): Promise<RepoState | null> {
  const state = await readState();
  return state.repo;
}

export async function saveQA(record: QARecord): Promise<void> {
  const state = await readState();
  const next = [record, ...state.qas].slice(0, 10);
  await writeState({ ...state, qas: next });
}

export async function getQAs(): Promise<QARecord[]> {
  const state = await readState();
  return state.qas;
}

export async function clearQAs(): Promise<void> {
  const state = await readState();
  await writeState({ ...state, qas: [] });
}

export async function healthDb(): Promise<{ ok: boolean; detail: string }> {
  try {
    await ensureDataFile();
    await readState();
    return { ok: true, detail: `state.json reachable (${DATA_FILE})` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "db error" };
  }
}
