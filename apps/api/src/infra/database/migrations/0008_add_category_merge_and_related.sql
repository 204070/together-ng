CREATE EXTENSION IF NOT EXISTS "vector";

--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint

CREATE TABLE "category_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" integer NOT NULL,
	"related_category_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "merged_into_id" integer;--> statement-breakpoint
ALTER TABLE "category_relations" ADD CONSTRAINT "category_relations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_relations" ADD CONSTRAINT "category_relations_related_category_id_categories_id_fk" FOREIGN KEY ("related_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_relations_pair_unique" ON "category_relations" USING btree ("category_id","related_category_id");--> statement-breakpoint
CREATE INDEX "category_relations_category_id_idx" ON "category_relations" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "category_relations_related_id_idx" ON "category_relations" USING btree ("related_category_id");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_merged_into_id_categories_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;