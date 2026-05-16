# 🐎 Stallion Advertising — Agency Management System

A complete, production-ready agency management SaaS built with React + Node.js + PostgreSQL.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Tailwind CSS, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (RS256) |
| Export | xlsx |

---

## Features

- **CEO Dashboard** — Revenue charts, KPI cards, activity feed, top clients
- **Clients Module** — Full CRUD, archive/restore, detail view, payment & task history
- **Revenue Tracker** — Payment records, monthly bar chart, by-service pie chart, Excel export
- **Expenses Tracker** — Fixed vs Variable, category breakdown, monthly trends, Excel export
- **Leads CRM** — Kanban board + list view, stage pipeline, activity timeline, stale alerts
- **Tasks Tracker** — Kanban board + list view, priority/status/assignee filters, overdue alerts
- **Dark/Light mode** — System-aware toggle
- **Role-based access** — Admin sees everything; Team Members see assigned items only

---

## Project Structure

```
STALLION ADVERTISING SYSTEM/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Full database schema
│   │   └── seed.ts              # Demo data seed
│   ├── src/
│   │   ├── lib/                 # Prisma client, JWT utils
│   │   ├── middleware/          # Auth, error handler
│   │   ├── routes/              # All API route handlers
│   │   └── index.ts             # Express app entry
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Layout, Sidebar, Header
│   │   ├── context/             # Auth, Theme
│   │   ├── lib/                 # API client, utils
│   │   ├── pages/               # All 6 module pages + Login
│   │   ├── types/               # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

---

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend (new terminal)
cd frontend
npm install
```

---

### 2. Environment Setup

```bash
# backend/.env
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/stallion_db"
JWT_SECRET="replace-with-a-long-random-secret-string"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
```

---

### 3. Database Setup

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Seed demo data
npm run db:seed
```

---

### 4. Run Development Servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
API will be at: `http://localhost:5000`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
App will be at: `http://localhost:5173`

---

### Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| CEO (Admin) | `ceo@stallion.com` | `admin123` |
| Team Member | `sara@stallion.com` | `member123` |
| Team Member | `omar@stallion.com` | `member123` |

---

## API Endpoints

### Auth
```
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/profile
PUT    /api/auth/change-password
```

### Clients
```
GET    /api/clients
GET    /api/clients/:id
POST   /api/clients
PUT    /api/clients/:id
DELETE /api/clients/:id          (archive)
POST   /api/clients/:id/restore
```

### Payments
```
GET    /api/payments
GET    /api/payments/summary
GET    /api/payments/by-service
GET    /api/payments/export      (Excel download)
POST   /api/payments
PUT    /api/payments/:id
DELETE /api/payments/:id
```

### Expenses
```
GET    /api/expenses
GET    /api/expenses/summary
GET    /api/expenses/export      (Excel download)
POST   /api/expenses
PUT    /api/expenses/:id
DELETE /api/expenses/:id
```

### Leads
```
GET    /api/leads
GET    /api/leads/stats
GET    /api/leads/:id
POST   /api/leads
PUT    /api/leads/:id
DELETE /api/leads/:id
POST   /api/leads/:id/activities
```

### Tasks
```
GET    /api/tasks
GET    /api/tasks/workload
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
```

### Dashboard
```
GET    /api/dashboard/stats
GET    /api/dashboard/revenue-chart
GET    /api/dashboard/top-clients
```

---

## Deployment

### Option A: Vercel (Frontend) + Railway (Backend + PostgreSQL)

#### Backend on Railway

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Add PostgreSQL plugin
4. Set environment variables in Railway dashboard:
   - `DATABASE_URL` (auto-provided by Railway PostgreSQL)
   - `JWT_SECRET` (generate with `openssl rand -base64 32`)
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://your-app.vercel.app`
5. Set build command: `npm install && npm run db:generate && npm run db:migrate:prod`
6. Set start command: `npm start`

#### Frontend on Vercel

1. Create account at [vercel.com](https://vercel.com)
2. Import GitHub repo
3. Set root directory to `frontend`
4. Add environment variable:
   - `VITE_API_URL=https://your-railway-backend.up.railway.app`
5. Update `frontend/src/lib/api.ts` baseURL to use `VITE_API_URL`

### Option B: Supabase (PostgreSQL)

1. Create project at [supabase.com](https://supabase.com)
2. Get connection string from Settings → Database
3. Use as `DATABASE_URL` in backend `.env`
4. Run migrations: `npm run db:migrate:prod`

---

## Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `amber-500` | `#f59e0b` | Primary accent, buttons, highlights |
| `slate-900` | `#0f172a` | Sidebar, dark surfaces |
| `stallion-dark` | `#0a0f1e` | Dark mode background |
| `emerald-600` | `#059669` | Revenue, success states |
| `red-500` | `#ef4444` | Expenses, overdue, errors |
| `blue-600` | `#2563eb` | In-progress, links |

---

## Adding Team Members

Use the API directly or extend the UI with a Team Settings page:

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Member","email":"new@stallion.com","password":"secure123","role":"TEAM_MEMBER"}'
```

---

## License

Private — Stallion Advertising internal use only.
