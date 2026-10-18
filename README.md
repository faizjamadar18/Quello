# Quello

Quello is a shared knowledge workspace for teams. Upload documents, organize them into workspaces, and ask questions in plain language. Every answer streams in as it is generated and cites the exact sources it drew from, so it can be verified before it is used.

Try Quello: https://quello.dev

## Features

- **Cited answers** — Ask in natural language, across the workspace or scoped to a single file. Responses stream in as they are written and list the documents and passages they came from.
- **Team workspaces** — Shared spaces with member roles, email invitations, and one shared document corpus per team. Chats stay private to each member.
- **Studio** — Write and maintain documents in a rich editor, with AI-assisted rewriting and drafting.
- **Integrations** — Bring in Notion, Google Drive, and GitHub through user-approved, read-only access.
- **MCP Server** — Connect Claude, ChatGPT, or Grok to a workspace through a secure, per-user key; Perplexity support is on the way.
- **Voice** — Talk to your workspace instead of typing it, with your own Vapi public key stored encrypted.

Uploads support PDF, Word (.docx), plain text (.txt), and Markdown (.md) files up to 20 MB.

## How It Works

When a document enters a workspace — uploaded or imported through an integration — it is processed into a searchable index. When someone asks a question, the system retrieves the most relevant passages and the model answers using only those, citing each source. Nothing is answered from the model's imagination, and nothing outside the workspace is used.

## Assistant Access (MCP)

Quello runs a remote MCP (Model Context Protocol) server over Streamable HTTP, so external assistants can search a workspace and fetch full documents — the same grounded retrieval the app uses, always read-only. Each connection is authenticated per user, either through a quick OAuth sign-in or a personal key created on the MCP Server page, where the server URL is also shown.

| Assistant | How it connects |
|-----------|-----------------|
| Claude | OAuth sign-in or personal key |
| ChatGPT | OAuth sign-in or personal key |
| Grok | Personal key |
| Perplexity | Coming soon |

## Technology

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, TipTap |
| Backend | FastAPI, Python 3.11+ |
| Database | MongoDB Atlas |
| Search index | Qdrant, with Google text embeddings |
| Language models | Groq-hosted models via LangChain, with automatic fallbacks |
| Document storage | Cloudflare R2 (local disk fallback in development) |
| Authentication | Google OAuth with signed session tokens |

## Getting Started

### Requirements

- Python 3.11+
- Node.js 20+
- A MongoDB database (Atlas or local)
- A Qdrant instance (cloud or local)
- A Google AI Studio key (https://aistudio.google.com/apikey)
- A Groq key (https://console.groq.com/)
- Google OAuth credentials for sign-in

### Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate      # Windows
source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
cp .env.example .env         # add your credentials

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API runs at `http://localhost:8000`; interactive documentation is served at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The app proxies API calls to the local backend by default; to enable Google sign-in, copy `frontend/.env.example` to `frontend/.env.local` and set `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

### Configuration

Required backend variables (`backend/.env`):

| Variable | Purpose |
|----------|---------|
| `MONGODB_URL` | Database connection string |
| `JWT_SECRET` | Secret used to sign session tokens |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GROQ_API_KEY` | Groq key |
| `QDRANT_URL`, `QDRANT_API_KEY` | Search index endpoint and credentials |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `CORS_ORIGINS` | Allowed frontend origins |

Optional settings — document storage (R2), integrations (Notion, Drive, GitHub), voice (bring your own Vapi key), invite email (Resend), and the public MCP URL — are documented with defaults in `backend/.env.example` and `frontend/.env.example`.

## Deployment

### Backend (Render)

A `render.yaml` blueprint is included in `backend/`. To configure manually, create a Web Service pointed at this repository with root directory `backend`, build command `pip install --prefer-binary -r requirements.txt`, and start command `bash start.sh`, then set the environment variables above.

### Frontend (Vercel)

Import `frontend/` as a Vercel project and set `NEXT_PUBLIC_API_URL` (the backend URL) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. The Google Drive integration additionally needs `NEXT_PUBLIC_GOOGLE_API_KEY` and `NEXT_PUBLIC_GOOGLE_APP_ID` for the Google Picker. No other steps are required.

## API

Authentication uses a token issued at sign-in, sent as `Authorization: Bearer <token>` on API requests.

The API covers account and profile management, workspaces and membership, document upload and retrieval, Studio documents, chat threads and streamed Q&A, integrations, voice sessions, and a remote MCP server (served at `/mcp`) with personal access keys. The complete interactive reference is generated at `/docs` on a running instance.

## Security

- Sign-in is delegated to Google OAuth; the application does not store passwords.
- Session tokens are signed and expire. Connector tokens and voice keys are encrypted at rest; MCP personal keys are stored as SHA-256 hashes and shown only once, at creation.
- Integration and assistant (MCP) access is read-only.
- Keys and secrets live only in server-side environment variables and are never shipped to the client.

## Testing

```bash
# Backend (database layer is mocked; no external services required)
cd backend
pip install -r requirements-dev.txt
python -m pytest -q
flake8 app/ --select=F,E9

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
```

CI runs the full suite on every push to `main` and on all pull requests (`.github/workflows/ci.yml`).

## Project Structure

```
backend/    FastAPI application (app/routes, app/services, app/models) with its test suite
frontend/   Next.js application (src/app, src/components, src/hooks, src/context)
docs/       Design system reference
```

## Contributing

Issues and pull requests are welcome. For larger changes, open an issue first to discuss the approach. CI must pass on every pull request: backend tests and lint, frontend lint and typecheck.

## License

MIT. See [LICENSE](./LICENSE).
