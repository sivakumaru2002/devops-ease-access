# DevOps Ease Access

Accessible Azure DevOps observability starter application (PAT authentication) with:

- Secure PAT-based Azure DevOps connectivity
- Project and pipeline dashboards
- Build/run monitoring and failure intelligence
- Optional Azure OpenAI-powered failure summarization
- Accessibility-first frontend patterns

## Monorepo Structure

- `backend/` FastAPI service for Azure DevOps integration, analytics, and optional AI insights.
- `frontend/` accessible single-page application.
- `docs/` architecture and technology recommendations.

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (React + TypeScript)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:4173`.

## Security Notes (PAT Mode)

- PAT is the active authentication mode for this version.
- PAT never touches browser storage in this starter.
- PAT is encrypted in backend volatile memory using `APP_ENCRYPTION_KEY`.
- Use least-privilege PAT scopes, short token lifetimes, HTTPS, and secret managers in production.
- Copy `backend/.env.example` to `backend/.env` and set `APP_ENCRYPTION_KEY`.

See `docs/architecture.md` for full design and deployment guidance.
