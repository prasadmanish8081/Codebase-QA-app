# Codebase Q&A with Proof (Option B)

Web app to ingest a codebase (GitHub public repo or ZIP), ask architecture/code questions, and return answers with evidence snippets (file path, line range, and code block).

## Implemented features

- Home page with clear 2-step workflow
- Ingest via:
  - Public GitHub URL (`/owner/repo` or `/owner/repo/tree/branch`)
  - ZIP upload (max 15MB)
- Q&A response includes:
  - answer text
  - retrieved snippets
  - file path + line ranges
  - source file links (for GitHub sources)
- Last 10 Q&As persisted in local storage file
- Status page with backend/database/LLM health checks
- Input validation and typed API error handling

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- Local JSON persistence (`data/state.json`)
- Groq OpenAI-compatible Chat Completions API (default)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
copy .env.example .env.local
```

3. Edit `.env.local`:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant
```

Optional:

```env
DATA_DIR=./data
```

4. Run:

```bash
npm run dev
```

App: `http://localhost:3000`  
Status: `http://localhost:3000/status`

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

Or all-in-one:

```bash
npm run quality
```

## API endpoints

- `POST /api/ingest` (multipart)
  - fields: `githubUrl` or `zipFile`
- `POST /api/qa` (json)
  - body: `{ "question": "..." }`
- `GET /api/history`
- `GET /api/status`

## What is done

- End-to-end Option B requirements
- Evidence-first responses with retriever + LLM answer synthesis
- Q&A history (last 10)
- Health diagnostics page

## Current limitations

- Retrieval is lexical scoring (no vector embeddings)
- Very large repositories are truncated by file count/size limits
- Only public GitHub repositories are supported
- No user authentication layer
- On serverless hosts, filesystem history uses temporary storage (`/tmp`) unless you attach a real database

## Deployment (Vercel)

- Push repo to GitHub
- Import into Vercel
- Add env vars from `.env.example`
- Deploy

