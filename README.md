# GIKI Complaint Management System (GIKomplain)

A full-stack complaint management system for GIKI students, faculty, and staff.

## Features
- **Role-Based Access Control**: Student, Faculty, Staff, Dept Officer, Admin.
- **Complaint Management**: Submit, Track, Claim, Resolve, Escalate.
- **File Attachments**: Support for multiple file uploads.
- **Audit Logs**: Track all actions.
- **Reporting**: Basic analytics on complaint volume.

## Tech Stack
- **Frontend**: Next.js 16, React, Vanilla CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Docker), raw SQL via `pg` (node-postgres)
- **Auth**: JWT, Bcrypt

## Setup

1. **Start Postgres** (Docker required)
   ```bash
   docker compose up -d
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   ```bash
   npm run db:init   # applies sql/schema.sql
   npm run db:seed   # seeds departments + admin user
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Default Accounts (if seeded)
- **Admin**: `admin@giki.edu.pk` / `admin123`
