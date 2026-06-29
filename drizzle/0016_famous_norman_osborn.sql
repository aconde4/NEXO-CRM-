CREATE TABLE "deal_stage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"deal_id" uuid NOT NULL,
	"pipeline_id" uuid,
	"from_stage_id" uuid,
	"to_stage_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_stage_events" ADD CONSTRAINT "deal_stage_events_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_events" ADD CONSTRAINT "deal_stage_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_events" ADD CONSTRAINT "deal_stage_events_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_events" ADD CONSTRAINT "deal_stage_events_from_stage_id_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_events" ADD CONSTRAINT "deal_stage_events_to_stage_id_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_stage_events_owner_idx" ON "deal_stage_events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "deal_stage_events_deal_idx" ON "deal_stage_events" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_stage_events_to_idx" ON "deal_stage_events" USING btree ("to_stage_id");--> statement-breakpoint
CREATE INDEX "deal_stage_events_at_idx" ON "deal_stage_events" USING btree ("at");--> statement-breakpoint
-- Backfill (6.4i): un evento de entrada por negocio existente, en su etapa actual.
INSERT INTO "deal_stage_events" ("owner_id", "deal_id", "pipeline_id", "from_stage_id", "to_stage_id", "at")
SELECT "owner_id", "id", "pipeline_id", NULL, "stage_id", "stage_changed_at"
FROM "deals"
WHERE "deleted_at" IS NULL;