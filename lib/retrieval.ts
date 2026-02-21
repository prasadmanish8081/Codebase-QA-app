import { RepoFile, StoredSnippet } from "@/lib/types";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "where", "what", "how", "this", "that", "from", "into", "about", "work", "works", "handled", "handle", "code"
]);

function tokenize(input: string): string[] {
  const camelPieces = input
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  return Array.from(
    new Set(
      [...camelPieces]
    )
  ).slice(0, 30);
}

function looksLikeTestFile(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.includes("/__tests__/") ||
    lower.includes("/fixtures/")
  );
}

function shouldPreferTests(question: string): boolean {
  return /\b(test|spec|coverage|assert)\b/i.test(question);
}

function countTermHits(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx >= 0) {
      score += 8;
      score += Math.max(0, 1500 - idx) / 1500;
    }
  }

  return score;
}

function bestLineWindow(content: string, terms: string[]): { startLine: number; endLine: number; code: string } {
  const lines = content.split(/\r?\n/);
  const maxLook = Math.min(lines.length, 1200);

  let bestLine = 0;
  let bestScore = -1;

  for (let i = 0; i < maxLook; i += 1) {
    const lineScore = terms.reduce((acc, term) => (lines[i].toLowerCase().includes(term) ? acc + 1 : acc), 0);
    if (lineScore > bestScore) {
      bestScore = lineScore;
      bestLine = i;
    }
  }

  const start = Math.max(0, bestLine - 7);
  const end = Math.min(lines.length, bestLine + 11);

  return {
    startLine: start + 1,
    endLine: end,
    code: lines.slice(start, end).join("\n")
  };
}

export function retrieveSnippets(files: RepoFile[], question: string, topK = 6): StoredSnippet[] {
  const terms = tokenize(question);
  if (!terms.length) return [];
  const preferTests = shouldPreferTests(question);

  const scored = files
    .map((file) => {
      const pathScore = countTermHits(file.path, terms) * 1.5;
      const head = file.content.slice(0, 16_000);
      const bodyScore = countTermHits(head, terms);
      let score = pathScore + bodyScore;

      if (!preferTests && looksLikeTestFile(file.path)) {
        score *= 0.55;
      }

      return { file, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((item, idx) => {
    const window = bestLineWindow(item.file.content, terms);
    return {
      id: `S${idx + 1}`,
      path: item.file.path,
      startLine: window.startLine,
      endLine: window.endLine,
      code: window.code,
      score: Number(item.score.toFixed(2))
    };
  });
}
