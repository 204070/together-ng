ALTER TABLE "public"."requests" ADD COLUMN "anonymous_contributions_ok" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "public"."request_responses" ADD COLUMN "anonymous" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "public"."outcome_confirmations" ADD COLUMN "received" boolean;--> statement-breakpoint
CREATE TABLE "public"."contributor_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"completed_as_agreed" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "contributor_confirmations_contribution_id_unique" UNIQUE ("contribution_id"),
	CONSTRAINT "contributor_confirmations_contribution_id_foreign" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "contributor_confirmations_contributor_id_foreign" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "contributor_confirmations_contribution_id_idx" ON "public"."contributor_confirmations" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "contributor_confirmations_contributor_id_idx" ON "public"."contributor_confirmations" USING btree ("contributor_id");
