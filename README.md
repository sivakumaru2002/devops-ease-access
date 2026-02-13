# DevOps Ease Access

Accessible Azure DevOps observability starter application with:

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

## Security Notes

- PAT never touches browser storage in this starter.
- PAT is encrypted in backend volatile memory using `APP_ENCRYPTION_KEY`.
- Use HTTPS, short token lifetimes, and secret managers in production.

See `docs/architecture.md` for full design and deployment guidance.
