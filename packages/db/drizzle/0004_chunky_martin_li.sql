CREATE EXTENSION IF NOT EXISTS "vector";

--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint

CREATE TABLE "notification_dispatch_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"match_factors" jsonb,
	"decision" text NOT NULL,
	"reason" text,
	"caps_evaluated" jsonb,
	"cap_window" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_dispatch_log" ADD CONSTRAINT "notification_dispatch_log_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_dispatch_log" ADD CONSTRAINT "notification_dispatch_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_dispatch_log_request_id_idx" ON "notification_dispatch_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "notification_dispatch_log_user_id_idx" ON "notification_dispatch_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_dispatch_log_created_at_idx" ON "notification_dispatch_log" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_request_user_unique" ON "notifications" USING btree ("request_id","user_id");