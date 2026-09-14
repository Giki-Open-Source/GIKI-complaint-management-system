# GIKomplain

A complaint management system for GIK Institute. Students and staff raise complaints, departmental supervisors claim and resolve them, and administrators oversee the whole workflow with a full audit trail behind it.

Deployed and in live use.

---

## What it does

**Complaint lifecycle.** A complaint moves through submission, assignment, claiming, response, resolution, and escalation. Every transition is recorded against the acting user in an audit log, so the history of a complaint is reconstructable after the fact.

**Role based access control.** Five roles with distinct permissions: Student, Faculty, Staff, Department Officer, and Administrator. Permission checks live in `lib/permissions.ts` and are enforced on the server, not in the interface. Administrator accounts cannot be self registered and exist only through the seed script.

**Verified registration.** New accounts are confirmed by a six digit one time passcode delivered over email before the account becomes usable.

**Attachments and evidence.** Complaints carry file uploads, handled through a dedicated upload route with generated identifiers rather than user supplied filenames.

**Reporting.** Administrators export complaint and supervisor data as PDF for record keeping.

---

## Design decisions worth noting

**No ORM.** Database access is hand written SQL through `node-postgres`, centralized in `lib/db.ts`. The schema lives in `sql/schema.sql` as plain DDL. This was deliberate: the query patterns here are simple enough that an ORM adds a translation layer without removing work, and writing the SQL directly keeps the data access legible and the query plans predictable.

**Server enforced authorization.** JWTs are issued and verified with `jose` and `jsonwebtoken`, passwords hashed with `bcryptjs`, and route protection applied in `middleware.ts` before any handler runs. Client side checks exist for interface state only and are never the sole gate.

**Schema validation at the boundary.** Incoming request bodies are validated with `zod` in the API routes so malformed input fails before it reaches the database.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 with React 19, App Router |
| API | Next.js route handlers under `app/api` |
| Database | PostgreSQL 16, accessed with `pg` and raw SQL |
| Auth | JWT with `jose` and `jsonwebtoken`, `bcryptjs` hashing |
| Email | Resend, for one time passcode delivery |
| Validation | `zod` |
| Export | `pdfkit` |
| Styling | CSS Modules and global CSS, no framework |
| Icons | `lucide-react` |

---

## Schema

Six tables: `Department`, `User`, `Complaint`, `Attachment`, `Comment`, `AuditLog`. Defined in `sql/schema.sql`.

---

## Running locally

**Requirements:** Node.js 20 or newer, Docker, and a Resend API key for email delivery.

**1. Clone and install**

```bash
git clone https://github.com/Giki-Open-Source/GIKI-complaint-management-system.git
cd GIKI-complaint-management-system
npm install
```

**2. Start PostgreSQL**

```bash
docker compose up -d
```

This brings up Postgres 16 on port 5434 with a persistent volume.

**3. Configure the environment**

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5434/giki_complaints
JWT_SECRET=YOUR_JWT_SECRET
RESEND_API_KEY=YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=YOUR_VERIFIED_SENDER_ADDRESS
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate a strong random value for `JWT_SECRET`, for example with `openssl rand -base64 32`. Never commit `.env.local`.

**4. Initialize and seed**

```bash
npm run db:init     # applies sql/schema.sql
npm run db:seed     # creates departments and the initial administrator
```

The seed script reads the initial administrator address and password from environment variables. Set them before running it, and change the password immediately after first sign in. No default credentials are distributed with this repository.

**5. Run**

```bash
npm run dev
```

Available at `http://localhost:3000`.

---

## Project layout

```
app/
  api/            Route handlers: auth, complaints, users, departments, upload, export
  dashboard/      Role scoped dashboards for students, departments, and admins
  login/          Authentication pages
  register/
lib/
  db.ts           PostgreSQL pool and query helpers
  auth.ts         Session handling
  jwt.ts          Token issue and verification
  otp.ts          One time passcode generation and checking
  permissions.ts  Role to capability mapping
  email.ts        Resend integration
  export.ts       PDF generation
  enums.ts        Roles, statuses, categories
sql/schema.sql    Database schema
scripts/          Database initialization and seeding
middleware.ts     Route protection
```

---

## Security notes

- Passwords are hashed with bcrypt; plaintext is never stored.
- Authorization is enforced server side on every protected route.
- Administrator accounts are provisioned by seed only and cannot be created through registration.
- All secrets are supplied through environment variables. Nothing sensitive is committed to the repository.

---

## Contributing

Issues and pull requests are welcome. Please run `npm run lint` before opening a pull request.
