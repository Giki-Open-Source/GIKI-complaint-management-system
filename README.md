# GIKI Complaint Management System (GIKomplain)

A full-stack complaint management system for GIKI students, faculty, and staff.

**Live**: https://www.awssbggiki.app

## Features
- **Role-Based Access Control**: Student, Faculty, Staff, Dept Officer, Admin. Admin is not self-registerable — only the seeded account (or one created directly against the database) can hold that role.
- **Email Verification**: New accounts verify via a 6-digit OTP sent by email (Resend), not a mock link.
- **Complaint Management**: Submit, Track, Claim, Resolve, Escalate.
- **File Attachments**: Support for multiple file uploads.
- **Audit Logs**: Track all actions.
- **Reporting**: Basic analytics on complaint volume.

## Tech Stack
- **Frontend**: Next.js 16, React, Vanilla CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Docker), raw SQL via `pg` (node-postgres) — no ORM
- **Auth**: JWT, Bcrypt
- **Email**: Resend (OTP verification codes)

## Setup

1. **Start Postgres** (Docker required)
   ```bash
   docker compose up -d
   ```

2. **Configure environment** — create a `.env` file in the project root:
   ```bash
   DATABASE_URL="postgresql://giki:giki@localhost:5434/giki_complaints"
   JWT_SECRET="<random string>"
   RESEND_API_KEY="<your Resend API key>"
   RESEND_FROM_EMAIL="onboarding@resend.dev"   # or an address on a domain you've verified with Resend
   ```
   Without a verified domain on Resend, `RESEND_FROM_EMAIL` can only deliver to the email address your Resend account itself is registered under (sandbox mode). Verify a domain at resend.com/domains to send to arbitrary recipients.

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Database Setup**
   ```bash
   npm run db:init   # applies sql/schema.sql
   npm run db:seed   # seeds departments + admin user
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

6. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Default Accounts (if seeded)
- **Admin**: `admin@giki.edu.pk` / `admin123`
