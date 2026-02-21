import AdmZip from "adm-zip";
import { RepoFile, RepoGitMeta } from "@/lib/types";

const MAX_FILE_BYTES = 150_000;
const MAX_TOTAL_FILES = 500;
const FETCH_TIMEOUT_MS = 12_000;

const BLOCKED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".pdf", ".zip", ".gz", ".tar", ".woff", ".woff2", ".ttf", ".exe", ".dll", ".mp4", ".mp3", ".lock"
];

const BLOCKED_PATH_PARTS = [".git", "node_modules", ".next", "dist", "build", "target", "coverage", "vendor"];

function isProbablyText(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  if (BLOCKED_PATH_PARTS.some((part) => lower.split("/").includes(part))) return false;
  return true;
}

function sanitizePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes(":") || normalized.startsWith("/")) {
    return "";
  }
  return normalized;
}

function parseGitHubUrl(input: string): { owner: string; repo: string; branch?: string } {
  const trimmed = input.trim();

  const treeMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/tree\/([^\/]+)(?:\/.*)?\/?$/i
  );
  if (treeMatch) {
    return { owner: treeMatch[1], repo: treeMatch[2], branch: decodeURIComponent(treeMatch[3]) };
  }

  const rootMatch = trimmed.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git|\/)?$/i);
  if (rootMatch) {
    return { owner: rootMatch[1], repo: rootMatch[2] };
  }

  throw new Error("Use a public GitHub repo URL like https://github.com/owner/repo");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "codebase-qa-proof"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadGitHubZip(githubUrl: string): Promise<{ meta: RepoGitMeta; zipBytes: Buffer }> {
  const parsed = parseGitHubUrl(githubUrl);
  const branches = parsed.branch ? [parsed.branch] : ["main", "master"];

  for (const branch of branches) {
    const zipUrl = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/refs/heads/${encodeURIComponent(branch)}`;
    const response = await fetchWithTimeout(zipUrl);
    if (!response.ok) {
      continue;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      meta: {
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
        url: `https://github.com/${parsed.owner}/${parsed.repo}`
      },
      zipBytes: bytes
    };
  }

  throw new Error("Failed to download repository zip (branch not found or repo is private)");
}

function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 2000));
  for (const byte of sample) {
    if (byte === 0) return true;
  }
  return false;
}

export function buildSourceUrlForPath(meta: RepoGitMeta | undefined, filePath: string): string | undefined {
  if (!meta) return undefined;
  return `https://github.com/${meta.owner}/${meta.repo}/blob/${meta.branch}/${filePath}`;
}

export function extractTextFilesFromZip(zipBytes: Buffer): RepoFile[] {
  const zip = new AdmZip(zipBytes);
  const entries = zip.getEntries();
  const out: RepoFile[] = [];

  for (const entry of entries) {
    if (out.length >= MAX_TOTAL_FILES) break;
    if (entry.isDirectory) continue;
    if (entry.header.size > MAX_FILE_BYTES) continue;

    const fullPath = sanitizePath(entry.entryName);
    if (!fullPath) continue;

    const pathWithoutRoot = sanitizePath(fullPath.split("/").slice(1).join("/")) || fullPath;
    if (!pathWithoutRoot || !isProbablyText(pathWithoutRoot)) continue;

    const rawBuffer = entry.getData();
    if (!rawBuffer.length || looksBinary(rawBuffer)) continue;

    const content = rawBuffer.toString("utf8").trim();
    if (!content) continue;

    out.push({ path: pathWithoutRoot, content });
  }

  if (!out.length) {
    throw new Error("No readable text files found in the zip");
  }

  return out;
}
