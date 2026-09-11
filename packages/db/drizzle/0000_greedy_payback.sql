CREATE EXTENSION IF NOT EXISTS "vector";

--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint

CREATE TYPE "public"."condition_phase" AS ENUM('pre_handoff', 'handoff', 'return');--> statement-breakpoint
CREATE TYPE "public"."contribution_status" AS ENUM('accepted', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."digest_frequency" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."help_type" AS ENUM('borrow', 'receive', 'access', 'learn', 'collaborate');--> statement-breakpoint
CREATE TYPE "public"."lending_status" AS ENUM('requested', 'agreed', 'in_progress', 'returned', 'issue_reported', 'disputed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('online', 'in_person', 'both');--> statement-breakpoint
CREATE TYPE "public"."moderation_action_type" AS ENUM('warning', 'suspend', 'restore', 'restrict', 'ban', 'remove_content', 'feature', 'investigate');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('new_match', 'request_response', 'request_update', 'response_accepted', 'response_declined', 'contribution_accepted', 'contribution_in_progress', 'contribution_completed', 'confirmation_required', 'community_interest', 'message_received');--> statement-breakpoint
CREATE TYPE "public"."outcome_response" AS ENUM('yes_significantly', 'yes_somewhat', 'not_yet', 'no');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'under_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_subject_type" AS ENUM('request', 'profile', 'contribution', 'message', 'resource', 'resource_listing', 'lending_agreement');--> statement-breakpoint
CREATE TYPE "public"."request_state" AS ENUM('draft', 'published', 'receiving_responses', 'help_arranged', 'in_progress', 'completed', 'closed', 'cancelled', 'archived', 'under_review');--> statement-breakpoint
CREATE TYPE "public"."resource_availability" AS ENUM('given_away', 'lent_temporarily', 'supervised_use', 'local_use_only', 'remote_digital');--> statement-breakpoint
CREATE TYPE "public"."resource_kind" AS ENUM('book', 'tool', 'computer', 'camera', 'musical_instrument', 'equipment', 'educational_material', 'other');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('available', 'lent', 'unavailable', 'archived');--> statement-breakpoint
CREATE TYPE "public"."response_status" AS ENUM('pending', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'moderate', 'serious');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'banned', 'deactivated');--> statement-breakpoint
CREATE TABLE "badges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "badges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" uuid NOT NULL,
	"badge_id" integer NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributor_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" integer,
	"skill_id" integer,
	"skill_level" "skill_level",
	"modality" "modality" DEFAULT 'both' NOT NULL,
	"location" text,
	"available_to_lend" boolean DEFAULT false NOT NULL,
	"willing_to_mentor" boolean DEFAULT false NOT NULL,
	"willing_to_answer_questions" boolean DEFAULT false NOT NULL,
	"willing_to_collaborate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"digest_enabled" boolean DEFAULT false NOT NULL,
	"digest_frequency" "digest_frequency" DEFAULT 'weekly',
	"notify_new_matches" boolean DEFAULT true NOT NULL,
	"notify_remote" boolean DEFAULT true NOT NULL,
	"notify_local" boolean DEFAULT true NOT NULL,
	"notify_resource_lending" boolean DEFAULT true NOT NULL,
	"notify_mentorship" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"response_id" uuid,
	"status" "contribution_status" DEFAULT 'accepted' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"response" "outcome_response" NOT NULL,
	"explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"location" text,
	"profile_photo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_id" integer,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"score" numeric NOT NULL,
	"reasons" jsonb,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"message" text NOT NULL,
	"modality" "modality",
	"status" "response_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"category_id" integer,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"barrier" text NOT NULL,
	"help_needed" text NOT NULL,
	"state" "request_state" DEFAULT 'draft' NOT NULL,
	"modality" "modality" DEFAULT 'both',
	"help_type" "help_type",
	"location" text,
	"time_commitment" text,
	"duration" text,
	"deadline" timestamp with time zone,
	"skill_level" "skill_level",
	"intended_outcome" text,
	"quantity" text,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closed_reason" text,
	"under_review" boolean DEFAULT false NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce("requests"."title", '') || ' ' || coalesce("requests"."goal", '') || ' ' || coalesce("requests"."barrier", '') || ' ' || coalesce("requests"."help_needed", ''))) STORED,
	"embedding" vector(384),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_user_request_unique" UNIQUE("user_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "condition_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lending_agreement_id" uuid NOT NULL,
	"recorded_by" uuid NOT NULL,
	"phase" "condition_phase" NOT NULL,
	"description" text,
	"photo_keys" text[],
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lending_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"status" "lending_status" DEFAULT 'requested' NOT NULL,
	"terms" text,
	"lending_period" text,
	"return_expectations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"category_id" integer,
	"title" text NOT NULL,
	"description" text,
	"kind" "resource_kind" NOT NULL,
	"condition" text,
	"location" text,
	"availability" "resource_availability" NOT NULL,
	"lending_terms" text,
	"photo_keys" text[],
	"high_value" boolean DEFAULT false NOT NULL,
	"status" "resource_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_user_id" uuid NOT NULL,
	"action" "moderation_action_type" NOT NULL,
	"severity" "severity" DEFAULT 'low' NOT NULL,
	"reason" text,
	"performed_by" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"subject_type" "report_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_capabilities" ADD CONSTRAINT "contributor_capabilities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_capabilities" ADD CONSTRAINT "contributor_capabilities_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_capabilities" ADD CONSTRAINT "contributor_capabilities_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_response_id_request_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."request_responses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_confirmations" ADD CONSTRAINT "outcome_confirmations_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_confirmations" ADD CONSTRAINT "outcome_confirmations_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_matches" ADD CONSTRAINT "request_matches_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_matches" ADD CONSTRAINT "request_matches_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_records" ADD CONSTRAINT "condition_records_lending_agreement_id_lending_agreements_id_fk" FOREIGN KEY ("lending_agreement_id") REFERENCES "public"."lending_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_records" ADD CONSTRAINT "condition_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lending_agreements" ADD CONSTRAINT "lending_agreements_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lending_agreements" ADD CONSTRAINT "lending_agreements_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lending_agreements" ADD CONSTRAINT "lending_agreements_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "badges_name_unique" ON "badges" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "badges_slug_unique" ON "badges" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_badges_user_badge_unique" ON "user_badges" USING btree ("user_id","badge_id");--> statement-breakpoint
CREATE INDEX "user_badges_badge_id_idx" ON "user_badges" USING btree ("badge_id");--> statement-breakpoint
CREATE INDEX "contributor_capabilities_user_id_idx" ON "contributor_capabilities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contributor_capabilities_category_id_idx" ON "contributor_capabilities" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "contributor_capabilities_skill_id_idx" ON "contributor_capabilities" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contributor_capabilities_user_category_skill_unique" ON "contributor_capabilities" USING btree ("user_id","category_id","skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_id_unique" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contributions_request_id_idx" ON "contributions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "contributions_contributor_id_idx" ON "contributions" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "contributions_status_idx" ON "contributions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "outcome_confirmations_contribution_id_unique" ON "outcome_confirmations" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "outcome_confirmations_recipient_id_idx" ON "outcome_confirmations" USING btree ("recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_unique" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_display_name_idx" ON "profiles" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_retired_at_idx" ON "categories" USING btree ("retired_at");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_slug_unique" ON "skills" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_category_name_unique" ON "skills" USING btree ("category_id","name");--> statement-breakpoint
CREATE INDEX "skills_category_id_idx" ON "skills" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "skills_retired_at_idx" ON "skills" USING btree ("retired_at");--> statement-breakpoint
CREATE UNIQUE INDEX "request_matches_request_contributor_unique" ON "request_matches" USING btree ("request_id","contributor_id");--> statement-breakpoint
CREATE INDEX "request_matches_contributor_id_idx" ON "request_matches" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "request_responses_request_id_idx" ON "request_responses" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_responses_contributor_id_idx" ON "request_responses" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "request_responses_status_idx" ON "request_responses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "request_responses_request_contributor_unique" ON "request_responses" USING btree ("request_id","contributor_id");--> statement-breakpoint
CREATE INDEX "requests_author_id_idx" ON "requests" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "requests_category_id_idx" ON "requests" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "requests_state_idx" ON "requests" USING btree ("state");--> statement-breakpoint
CREATE INDEX "requests_created_at_idx" ON "requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "requests_search_vector_idx" ON "requests" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "votes_request_id_idx" ON "votes" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "condition_records_lending_agreement_id_idx" ON "condition_records" USING btree ("lending_agreement_id");--> statement-breakpoint
CREATE INDEX "lending_agreements_resource_id_idx" ON "lending_agreements" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "lending_agreements_owner_id_idx" ON "lending_agreements" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "lending_agreements_borrower_id_idx" ON "lending_agreements" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "resources_owner_id_idx" ON "resources" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "resources_category_id_idx" ON "resources" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "resources_kind_idx" ON "resources" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_user_id_idx" ON "moderation_actions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_action_idx" ON "moderation_actions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "reports_reporter_id_idx" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reports_subject_idx" ON "reports" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");