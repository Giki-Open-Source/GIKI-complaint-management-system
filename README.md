# GIKI Complaint Management System (GIKOmplain)

A full-stack complaint management system for GIKI students, faculty, and staff.

## Features
- **Role-Based Access Control**: Student, Faculty, Staff, Dept Officer, Admin.
- **Complaint Management**: Submit, Track, Claim, Resolve, Escalate.
- **File Attachments**: Support for multiple file uploads.
- **Audit Logs**: Track all actions.
- **Reporting**: Basic analytics on complaint volume.

## Tech Stack
- **Frontend**: Next.js 15, React, Vanilla CSS
- **Backend**: Next.js API Routes  
- **Database**: SQLite, Prisma ORM 
- **Auth**: JWT, Bcrypt

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Default Accounts (if seeded)
- **Admin**: `admin@giki.edu.pk` / `admin123`
