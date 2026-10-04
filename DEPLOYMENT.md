# EmotiCare AI — Deployment & Operations Guide

## 1. Local Development Setup

### Prerequisites
- Python 3.10+ (tested with Python 3.14)
- Node.js 18+ and npm
- Windows / macOS / Linux

### Step 1: Clone & Configure Environment
```bash
git clone <repo-url>
cd "mental health chatbot"

# Copy example environment configuration
copy .env.example .env
```
Ensure `.env` contains:
```env
ENVIRONMENT=development
JWT_SECRET_KEY=local-dev-jwt-secret-key-32-chars-minimum
EXPOSE_DEV_OTP=1
DATABASE_URL=sqlite:///./backend/manas_twin.db
```

### Step 2: Install Dependencies
```bash
# Python dependencies
pip install -r backend/requirements.txt

# Frontend dependencies
npm --prefix frontend install
```

### Step 3: Run the Services
**Terminal 1 — Backend API (FastAPI on Port 8008)**:
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8008 --reload
```

**Terminal 2 — Frontend Application (Vite on Port 5173)**:
```bash
npm --prefix frontend run dev
```

### Step 4: Verify Deployment
Open your browser and navigate to:
- **Application UI**: [http://localhost:5173](http://localhost:5173)
- **API Health Check**: [http://localhost:8008/api/health](http://localhost:8008/api/health)
- **Interactive Swagger Docs**: [http://localhost:8008/docs](http://localhost:8008/docs)

---

## 2. Production Deployment (PostgreSQL + Docker)

### Environment Configuration for Production
Set the following in your production secret store:
```env
ENVIRONMENT=production
JWT_SECRET_KEY=<generate-strong-64-character-secret>
EXPOSE_DEV_OTP=0
TESTING=0
DATABASE_URL=postgresql://emoticare_user:strong_password@postgres:5432/emoticare_production
```

### Production Build
```bash
# 1. Build optimized frontend bundle
npm --prefix frontend run build

# 2. Start production backend with Gunicorn / Uvicorn workers
uvicorn backend.app.main:app --host 0.0.0.0 --port 8008 --workers 4
```

### Database Schema Initialization
The database schema initializes automatically on backend startup via `init_db()` in `backend/app/database.py`. Indexes, constraints, foreign keys, and tables are verified deterministically without manual SQL execution.
