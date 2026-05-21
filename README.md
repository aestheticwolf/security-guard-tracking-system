# Sentinel Grid

Sentinel Grid is a modern Security Guard Tracking System built with a React frontend and a Node.js + Express backend. It includes secure authentication, guard attendance, selfie verification, live activity updates, location tracking, and an admin operations dashboard, all backed by a local SQLite database and local image storage.

## Phase 1 Includes

- Secure authentication with JWT sessions and bcrypt password hashing
- React + Vite frontend architecture
- Tailwind CSS design system with gradients and glassmorphism
- Framer Motion animation layer
- Axios API integration
- React Router protected route setup
- Role-based access for guards and admins
- Toast notifications
- Loading skeletons
- Premium landing page and responsive authentication flow
- Guard dashboard for attendance, selfies, live location sync, and patrol updates
- Admin dashboard for roster management, attendance visibility, and live operational monitoring
- Local SQLite database storage for guards, attendance, activities, locations, and selfies
- Local selfie image storage under `server/uploads/selfies`
- API error handling middleware
- Responsive mobile-friendly UI

## Tech Stack

- React + Vite
- Tailwind CSS
- Framer Motion
- Axios
- Node.js
- Express
- SQLite
- JWT
- bcryptjs
- Multer
- dotenv

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment values:

```bash
copy .env.example .env
```

3. Create the local SQLite database:

```bash
npm run db:init
```

This creates:

```text
%TEMP%/SentinelGrid/security.db
```

The command also creates the tables and seeds demo accounts if the database is empty.

4. Start the frontend and backend together:

```bash
npm run dev
```

5. Open the app:

```text
http://localhost:5173
```

The API runs on:

```text
http://localhost:5000
```

## SQLite Reset

If you want a clean local database again:

```bash
npm run db:reset
```

That recreates the SQLite file contents and reseeds the demo data.

## Demo Accounts

- Admin
  - Email: `admin@sentinel.local`
  - Password: `Admin@123`
- Guard
  - Email: `guard@sentinel.local`
  - Password: `Guard@123`
- Extra seeded guard
  - Email: `patrol@sentinel.local`
  - Password: `Patrol@123`

## Project Structure

```text
src/
  animations/         Shared motion presets
  components/         Reusable UI, feedback, skeletons
  context/            Auth context
  hooks/              Custom hooks
  layouts/            Shared page shells
  pages/              Route-level screens
  services/           Axios client + API modules
  styles/             Tailwind entry styles
  utils/              Formatters, device helpers, session storage

server/
  controllers/        Request handlers
  database/           SQLite connection + init script
  middleware/         Auth, async, error handlers
  models/             SQLite query layer
  routes/             Express route definitions
  services/           JWT, dashboard composition, selfie helpers
  uploads/            Local selfie storage
```

## Notes

- The SQLite database is initialized automatically on server start if needed, but `npm run db:init` is the explicit setup step for local development.
- By default the SQLite file is stored in `%TEMP%/SentinelGrid/security.db` for reliability on mapped workspaces. You can override it with `DB_FILE` in `.env`.
- Session expiry is enforced on the frontend and backend.
- The app uses browser geolocation for live tracking, so location permission is required for the full experience.
