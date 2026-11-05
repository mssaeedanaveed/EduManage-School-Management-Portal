# EduManage School Management Portal

EduManage is a full-stack school management portal with role-based experiences for administrators, teachers, students, and parents.

## Features

- Student, teacher, class, and subject administration
- Daily attendance and correction workflows
- Examinations, marks, grades, rankings, and printable report cards
- Weekly timetable management with collision checks
- Fee structures, payment tracking, defaulters, and printable fee vouchers
- Parent and student portals
- Notifications and school calendar
- MongoDB database status, synchronization, and collection monitoring

## Technology

- React 19, React Router, Tailwind CSS, Axios, and Vite
- Express and TypeScript
- MongoDB and Mongoose
- JSON Web Tokens and bcrypt
- jsPDF and jsPDF AutoTable

## Prerequisites

- Node.js 18 or newer
- npm or Bun
- MongoDB Atlas or a self-hosted MongoDB instance (optional for embedded demo mode)

## Installation

```bash
npm install
```

Copy the example environment file:

```bash
copy .env.example .env
```

Configure `.env` as needed:

```dotenv
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/school_portal?retryWrites=true&w=majority"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=3000

SCHOOL_NAME="EduManage School"
SCHOOL_BANK_NAME="Your Bank Name"
SCHOOL_BANK_ACCOUNT="0000000000"
```

Use a MongoDB database user and password under Atlas Database Access; do not use your Atlas account email as the database username. Add the server IP address to Atlas Network Access when using Atlas.

## Running the Application

### Development

```bash
npm run dev
```

Open `http://localhost:3000`. Vite serves the frontend and mounts the Express API in development.

### Production

```bash
npm run build
npm start
```

The Express server serves the built frontend and API from `http://localhost:3000`.

## Demo Accounts

The seed data provides these accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@school.edu` | `password123` |
| Teacher | `teacher@school.edu` | `password123` |
| Student | `student@school.edu` | `password123` |
| Parent | `parent@school.edu` | `password123` |

Change or remove demo credentials before deploying publicly.

To populate seed data through the seed script:

```bash
npx tsx server/scripts/seed.ts
```

## Database Modes

When `MONGODB_URI` is configured successfully, MongoDB is the portal's persistent data source and the server synchronizes the in-memory portal cache with MongoDB.

If MongoDB is not configured or the configured connection fails, the server can continue in embedded store mode with seeded demo data. Data in this mode is not durable MongoDB storage and may be lost when the process ends.

The Database Monitor page can connect to or disconnect from MongoDB for the current server process. Add a valid URI to `.env` to use that connection across restarts.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite and the API on port 3000 |
| `npm run build` | Build the frontend into `dist/` |
| `npm start` | Start the production Express server |
| `npm run preview` | Preview the Vite build |
| `npm run lint` | Run TypeScript checks |
| `npm run test:fees` | Run fee tests |
| `npm run test:attendance` | Run attendance tests |

## API

The REST API is available under `/api`. Major route groups include:

- `/api/auth`
- `/api/students`
- `/api/teachers`
- `/api/classes`
- `/api/subjects`
- `/api/attendance`
- `/api/results`
- `/api/timetable`
- `/api/fees`
- `/api/notifications`
- `/api/dashboard`
- `/api/database`
- `/api/admin`

Health check:

```text
GET /api/health
```

## Project Structure

```text
server/
  config/       Database configuration
  controllers/  Express request handlers
  data/         Seed data and embedded store
  middleware/   Authentication and authorization
  models/       Mongoose schemas
  routes/       REST API routes
  scripts/      Database utilities
  services/     Background jobs and synchronization
src/
  api/          Frontend API client
  components/   Shared UI components
  context/      Authentication state
  pages/        Role-based application pages
  types/        Frontend types
server.ts       Production server entry point
vite.config.ts  Frontend and development API configuration
```

## Security Notes

- Set a unique, strong `JWT_SECRET`.
- Do not commit `.env` or database credentials.
- Use HTTPS and restrictive database network rules in production.
