# DevOps Ease Access

Accessible Azure DevOps observability starter application (PAT authentication) with:

- Secure PAT-based Azure DevOps connectivity
- Project and pipeline dashboards
- Build/run monitoring and failure intelligence
- Optional Azure OpenAI-powered failure summarization
- Accessibility-first frontend patterns
- Manual resource cards grouped by project/environment (MongoDB-backed)
- Dashboard user auth with admin approval workflow

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
- Optional: set `MONGODB_URI` to persist resource cards in MongoDB.

See `docs/architecture.md` for full design and deployment guidance.


## Resource Cards (Manual Entry)

You can now add project/environment resource cards (name + URL + type + notes) from the dashboard UI.

- Stored in MongoDB when `MONGODB_URI` is configured.
- Falls back to in-memory storage if MongoDB is not configured (development convenience).
- Typical use: one project (e.g., `gpmd`) with multiple environments (`stage`, `preprod`, `prod`) and many resources per environment.


## Dashboard Auth + Approval

- Default admin is auto-created on backend startup:
  - **Email:** `admin@gmail.com`
  - **Password:** `admin`
- New users register from UI and remain pending until admin approval.
- Admin can approve users and create dashboard entries.
- Approved users can choose **Dashboard** or **DevOps** on second page.
- DevOps PAT connection now requires approved dashboard login first.


## UX Flow (Requested)

1. Login page is only for dashboard user login.
2. Second page has two cards:
   - **Dashboard Portal** (admin creates dashboard cards; users view)
   - **DevOps Page** (user manages org + PAT and connects)
3. DevOps org/PAT are stored against the logged-in user in MongoDB.
4. If PAT expires, user can update PAT from DevOps Page and reconnect.
