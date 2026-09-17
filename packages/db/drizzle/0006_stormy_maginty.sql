CREATE EXTENSION IF NOT EXISTS "vector";

--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint

ALTER TYPE "public"."notification_type" ADD VALUE 'request_closed' BEFORE 'response_accepted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'request_cancelled' BEFORE 'response_accepted';