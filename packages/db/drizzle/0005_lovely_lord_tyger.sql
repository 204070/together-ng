CREATE TABLE "contributor_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"completed_as_agreed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outcome_confirmations" ALTER COLUMN "response" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "outcome_confirmations" ADD COLUMN "received" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "request_responses" ADD COLUMN "anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "anonymous_contributions_ok" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contributor_confirmations" ADD CONSTRAINT "contributor_confirmations_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_confirmations" ADD CONSTRAINT "contributor_confirmations_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contributor_confirmations_contribution_id_unique" ON "contributor_confirmations" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "contributor_confirmations_contributor_id_idx" ON "contributor_confirmations" USING btree ("contributor_id");