CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"sequence_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"org_id" uuid,
	"deal_id" uuid,
	"current_step_id" uuid,
	"current_step_position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stop_reason" text,
	"inngest_run_id" text,
	"last_message_id" uuid,
	"last_event_at" timestamp with time zone,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_run_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"sequence_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"channel" text,
	"wait_days" integer DEFAULT 0 NOT NULL,
	"wait_hours" integer DEFAULT 0 NOT NULL,
	"template_id" uuid,
	"subject" text,
	"preheader" text,
	"body_html" text,
	"body_text" text,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"channel" text DEFAULT 'gmail_1to1' NOT NULL,
	"stop_on_reply" boolean DEFAULT true NOT NULL,
	"daily_limit" integer DEFAULT 50 NOT NULL,
	"window_start" text DEFAULT '09:00' NOT NULL,
	"window_end" text DEFAULT '18:00' NOT NULL,
	"time_zone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_current_step_id_sequence_steps_id_fk" FOREIGN KEY ("current_step_id") REFERENCES "public"."sequence_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_last_message_id_email_messages_id_fk" FOREIGN KEY ("last_message_id") REFERENCES "public"."email_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollments_owner_idx" ON "enrollments" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "enrollments_sequence_idx" ON "enrollments" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "enrollments_person_idx" ON "enrollments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "enrollments_org_idx" ON "enrollments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "enrollments_deal_idx" ON "enrollments" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "enrollments_current_step_idx" ON "enrollments" USING btree ("current_step_id");--> statement-breakpoint
CREATE INDEX "enrollments_status_idx" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enrollments_next_run_idx" ON "enrollments" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "enrollments_inngest_run_idx" ON "enrollments" USING btree ("inngest_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_sequence_person_unique" ON "enrollments" USING btree ("sequence_id","person_id");--> statement-breakpoint
CREATE INDEX "sequence_steps_owner_idx" ON "sequence_steps" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "sequence_steps_sequence_idx" ON "sequence_steps" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "sequence_steps_type_idx" ON "sequence_steps" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "sequence_steps_sequence_position_unique" ON "sequence_steps" USING btree ("sequence_id","position");--> statement-breakpoint
CREATE INDEX "sequences_owner_idx" ON "sequences" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "sequences_status_idx" ON "sequences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sequences_channel_idx" ON "sequences" USING btree ("channel");--> statement-breakpoint
CREATE UNIQUE INDEX "sequences_owner_name_unique" ON "sequences" USING btree ("owner_id","name");