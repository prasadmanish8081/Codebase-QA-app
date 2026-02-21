import { NextResponse } from "next/server";
import { getRepo, saveQA } from "@/lib/db";
import { answerWithProof } from "@/lib/llm";
import { buildSourceUrlForPath } from "@/lib/repo";
import { retrieveSnippets } from "@/lib/retrieval";
import { QARecord } from "@/lib/types";
import { validateQuestion } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: string };
    const question = validateQuestion(String(body.question || ""));

    const repo = await getRepo();
    if (!repo) {
      return NextResponse.json(
        { error: "No codebase loaded. Upload zip or provide GitHub URL first." },
        { status: 400 }
      );
    }

    const rawSnippets = retrieveSnippets(repo.files, question, 6);
    if (!rawSnippets.length) {
      return NextResponse.json({ error: "Could not retrieve relevant snippets" }, { status: 404 });
    }

    const snippets = rawSnippets.map((snippet) => ({
      ...snippet,
      sourceUrl: buildSourceUrlForPath(repo.github, snippet.path)
    }));

    const llm = await answerWithProof(question, snippets);
    const selectedIds = new Set(llm.snippetIds);
    const selectedSnippets = snippets.filter((s) => selectedIds.has(s.id));
    const finalSnippets = selectedSnippets.length ? selectedSnippets : snippets.slice(0, 3);

    const record: QARecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      question,
      answer: llm.answer,
      repoLabel: repo.sourceLabel,
      snippets: finalSnippets
    };

    await saveQA(record);

    return NextResponse.json({
      answer: record.answer,
      snippets: record.snippets,
      createdAt: record.createdAt,
      repoLabel: record.repoLabel
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Q&A failed";
    const status = /required|too long/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
