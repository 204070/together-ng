CREATE EXTENSION IF NOT EXISTS "vector";

--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;