# AI_NOTES

## AI tools used

- GPT-5 Codex agent for project scaffolding, refactoring, and documentation updates.

## What AI was used for

- Initial Next.js architecture and API route scaffolding
- Repo ingestion and retrieval strategy implementation
- LLM prompt and JSON-output control strategy
- Refactor pass for validation, reliability, and maintainability
- Documentation drafting and cleanup

## What was verified manually

- Each API endpoint behavior and error handling
- Input validation rules and edge cases
- Source-link generation for GitHub-backed snippets
- History persistence behavior (last 10 Q&As)
- Env-driven secrets handling (`.env.example`, no secrets committed)
- Local quality checks (`lint`, `typecheck`, `build`)

## LLM provider/model selection

- Provider: Groq (default)
- API: OpenAI-compatible Chat Completions
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Model: `llama-3.1-8b-instant` (configurable)

Reason:

- Low latency, cost-effective inference for iterative codebase Q&A
- OpenAI-compatible request schema reduces integration complexity
- Easy provider switching via environment variables

