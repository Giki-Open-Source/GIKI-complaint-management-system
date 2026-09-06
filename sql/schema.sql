-- GIKI Complaint Management System — Postgres schema
-- Table/column names are double-quoted to preserve the exact casing the app
-- (and formerly Prisma) uses everywhere: "User", "departmentId", "createdAt", etc.

CREATE TABLE IF NOT EXISTS "Department" (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Hierarchy: each department owns exactly one student-facing category 1:1,
-- plus the metadata needed for routing, default priority, and SLA display.
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "categoryLabel" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "defaultPriority" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "slaHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "escalationContactName" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "escalationContactTitle" TEXT;
-- Hostels get their own department each (own Supervisor, own queue) rather
-- than sharing one generic "Hostel Maintenance" bucket. Flagged so the
-- student-facing submit form can auto-route to the student's own hostel
-- instead of listing all of them as manually pickable categories.
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "isHostel" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "User" (
    id                 TEXT PRIMARY KEY,
    email              TEXT NOT NULL UNIQUE,
    password           TEXT NOT NULL,
    name               TEXT,
    role               TEXT NOT NULL DEFAULT 'STUDENT',
    "departmentId"     TEXT REFERENCES "Department"(id) ON DELETE SET NULL,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "emailVerified"    TIMESTAMPTZ,
    "otpCode"          TEXT,
    "otpExpiresAt"     TIMESTAMPTZ
);

-- Migrating from the old link-based verification flow to OTP codes.
ALTER TABLE "User" DROP COLUMN IF EXISTS "verificationToken";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMPTZ;

-- Profile details needed so officers know *where* to physically act on a
-- complaint (hostel/room for students, building/office + major/dept for
-- faculty & staff). Required before a complainant can submit a complaint.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hostelName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roomNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "major" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" TEXT;

CREATE TABLE IF NOT EXISTS "Complaint" (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    category            TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'SUBMITTED',
    "complainantId"     TEXT NOT NULL REFERENCES "User"(id),
    "assignedDeptId"    TEXT REFERENCES "Department"(id) ON DELETE SET NULL,
    "assignedOfficerId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
    "resolutionSummary" TEXT,
    "internalNotes"     TEXT,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMPTZ;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "reopenCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "Attachment" (
    id            TEXT PRIMARY KEY,
    url           TEXT NOT NULL,
    name          TEXT NOT NULL,
    size          INTEGER NOT NULL,
    "complaintId" TEXT NOT NULL REFERENCES "Complaint"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    id            TEXT PRIMARY KEY,
    action        TEXT NOT NULL,
    details       TEXT,
    "actorId"     TEXT NOT NULL REFERENCES "User"(id),
    "targetId"    TEXT,
    "complaintId" TEXT REFERENCES "Complaint"(id) ON DELETE SET NULL,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Comment" (
    id            TEXT PRIMARY KEY,
    content       TEXT NOT NULL,
    "complaintId" TEXT NOT NULL REFERENCES "Complaint"(id) ON DELETE CASCADE,
    "authorId"    TEXT NOT NULL REFERENCES "User"(id),
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Complaint_complainantId_idx" ON "Complaint" ("complainantId");
CREATE INDEX IF NOT EXISTS "Complaint_assignedDeptId_idx" ON "Complaint" ("assignedDeptId");
CREATE INDEX IF NOT EXISTS "Attachment_complaintId_idx" ON "Attachment" ("complaintId");
CREATE INDEX IF NOT EXISTS "Comment_complaintId_idx" ON "Comment" ("complaintId");
CREATE INDEX IF NOT EXISTS "AuditLog_complaintId_idx" ON "AuditLog" ("complaintId");

-- Postgres has no built-in equivalent of Prisma's @updatedAt — maintain it with a trigger.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_updated_at ON "User";
CREATE TRIGGER set_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_complaint_updated_at ON "Complaint";
CREATE TRIGGER set_complaint_updated_at
    BEFORE UPDATE ON "Complaint"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_comment_updated_at ON "Comment";
CREATE TRIGGER set_comment_updated_at
    BEFORE UPDATE ON "Comment"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
