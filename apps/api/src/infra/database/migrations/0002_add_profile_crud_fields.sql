CREATE EXTENSION IF NOT EXISTS "vector";

--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint

ALTER TABLE "profiles" ADD COLUMN "areas_of_interest" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "skills" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "resources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "contribution_availability" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "exact_address" text;