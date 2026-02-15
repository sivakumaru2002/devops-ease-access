# DevOps Ease Access

Modern Azure DevOps observability and resource management platform with:

- **Modern UI/UX**: Glassmorphism design with vibrant gradients and smooth animations
- **User Registration**: Self-service account creation with admin approval workflow
- **Role-Based Access**: Admin and user roles with clear visual indicators
- **Environment Filtering**: Filter resources by environment (dev, stage, prod, etc.)
- **Secure PAT Authentication**: Azure DevOps connectivity with encrypted PAT storage
- **Project & Pipeline Dashboards**: Real-time monitoring and analytics
- **Build/Run Intelligence**: Failure analysis with optional Azure OpenAI insights
- **Resource Management**: Manual resource cards grouped by project/environment (MongoDB-backed)
- **Accessibility-First**: WCAG-compliant with keyboard navigation and screen reader support

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


## ✨ Key Features

### 🎨 Modern UI/UX
- **Glassmorphism Design**: Frosted glass cards with backdrop blur effects
- **Vibrant Gradients**: Purple-blue primary, green success, orange warning, red danger
- **Smooth Animations**: Fade-in, slide-up, pulse, and hover micro-interactions
- **Inter Font**: Professional Google Font for enhanced readability
- **Responsive Design**: Optimized for desktop, tablet, and mobile

### 👥 User Management
- **Self-Service Registration**: New users can create accounts via "✨ Sign Up" button
- **Admin Approval Workflow**: All new accounts require admin approval before access
- **Role-Based Access Control**: 
  - 👑 **Admin**: Create dashboards, add/edit resources, approve users
  - 👤 **User**: View-only access to dashboards and resources
- **Visual Role Badges**: Clear indicators for admin vs user status

### 🌐 Environment Filtering
- **Smart Filtering**: Filter resources by environment (dev, stage, prod, preprod, etc.)
- **Dynamic List**: Automatically populated from available resources
- **Resource Count**: Live badge showing filtered resource count
- **Quick Toggle**: Switch between "All Environments" and specific environments

### 📦 Resource Management
- **Project-Environment Organization**: Resources grouped by Project → Environment
- **Quick Access URLs**: Click resource URLs to access directly
- **Metadata Support**: Add resource type, notes, and descriptions
- **Edit Permissions**: Admins and resource owners can edit


## Dashboard Auth + Approval

- **Default Admin**: Auto-created on backend startup
  - **Email:** `admin@gmail.com`
  - **Password:** `admin`
- **User Registration**: 
  - Click "✨ Sign Up" from login page
  - Fill email, username, password, confirm password
  - Account created with `approved: false`
- **Admin Approval**:
  - Admin sees pending users in "👥 Pending User Approvals" section
  - Click "✅ Approve" to grant access
  - User can then login successfully
- **Role Assignment**: 
  - Admin creates dashboards and manages resources
  - Users view dashboards and resources (read-only)
- **Environment Filter**: Select specific environment to view related resources only


## UX Flow

### New User Journey
1. **Register**: Click "✨ Sign Up", fill registration form
2. **Wait for Approval**: Account pending until admin approves
3. **Login**: Once approved, login with credentials
4. **Choose Portal**: Select "Dashboard Portal" or "DevOps Page"
5. **Browse Resources**: View dashboards, filter by environment, access resources

### Admin Journey
1. **Login**: Use admin credentials (admin@gmail.com / admin)
2. **Dashboard Portal**: Create new dashboards and project cards
3. **Manage Resources**: 
   - Select dashboard
   - Choose environment
   - Add resources with project, name, URL, type, notes
4. **Approve Users**: Review and approve pending user registrations
5. **Environment View**: Filter resources by environment to verify setup

### DevOps Integration
1. DevOps org/PAT stored against logged-in user in MongoDB
2. PAT can be updated from DevOps Page when expired
3. Requires approved dashboard login first


## Edge-case Handling

- Dashboard resources return 404 when dashboard ID is invalid
- Dashboard list refresh re-selects valid dashboard if previous was deleted/invalid
- Empty dashboard or resource states handled explicitly in UI
- Resource cards grouped by project + environment for easier scanning
- "No resources found" message when environment filter yields no results
- Password mismatch validation on registration
- Admin can edit existing manual resource cards
- Users see "view-only" notice when accessing dashboard portal
