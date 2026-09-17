CREATE EXTENSION IF NOT EXISTS "vector";

--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint

ALTER TABLE "requests" ADD COLUMN "vote_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_user_type_created_at_idx" ON "notifications" USING btree ("user_id","type","created_at");--> statement-breakpoint
CREATE INDEX "requests_state_created_at_idx" ON "requests" USING btree ("state","created_at" DESC NULLS LAST);