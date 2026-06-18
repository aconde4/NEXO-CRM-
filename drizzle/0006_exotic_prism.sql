CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"mailbox_id" uuid,
	"message_id" uuid,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"provider_event_id" text,
	"type" text NOT NULL,
	"recipient_email" text,
	"tracking_id" text,
	"url" text,
	"ip_address" text,
	"user_agent" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"mailbox_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"provider_message_id" text NOT NULL,
	"provider_thread_id" text NOT NULL,
	"rfc_message_id" text,
	"in_reply_to" text,
	"references_header" text,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bcc_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reply_to_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text,
	"snippet" text,
	"body_html" text,
	"body_text" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"headers" jsonb,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"tracking_id" text,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"mailbox_id" uuid NOT NULL,
	"provider_thread_id" text NOT NULL,
	"subject" text,
	"snippet" text,
	"status" text DEFAULT 'active' NOT NULL,
	"person_id" uuid,
	"org_id" uuid,
	"deal_id" uuid,
	"last_message_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"message_count" integer DEFAULT 0 NOT NULL,
	"unread" boolean DEFAULT false NOT NULL,
	"provider_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"display_name" text,
	"from_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"account_provider" text DEFAULT 'google' NOT NULL,
	"account_provider_account_id" text,
	"gmail_history_id" text,
	"last_synced_at" timestamp with time zone,
	"last_sync_started_at" timestamp with time zone,
	"last_sync_error" text,
	"daily_limit" integer DEFAULT 50 NOT NULL,
	"sent_today" integer DEFAULT 0 NOT NULL,
	"sent_today_reset_at" timestamp with time zone,
	"signature_html" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_events_owner_idx" ON "email_events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "email_events_mailbox_idx" ON "email_events" USING btree ("mailbox_id");--> statement-breakpoint
CREATE INDEX "email_events_message_idx" ON "email_events" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "email_events_type_idx" ON "email_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "email_events_occurred_idx" ON "email_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "email_events_tracking_idx" ON "email_events" USING btree ("tracking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_events_provider_unique" ON "email_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "email_messages_owner_idx" ON "email_messages" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "email_messages_mailbox_idx" ON "email_messages" USING btree ("mailbox_id");--> statement-breakpoint
CREATE INDEX "email_messages_thread_idx" ON "email_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "email_messages_direction_idx" ON "email_messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "email_messages_status_idx" ON "email_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_messages_from_idx" ON "email_messages" USING btree ("from_email");--> statement-breakpoint
CREATE INDEX "email_messages_sent_idx" ON "email_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_messages_received_idx" ON "email_messages" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_messages_mailbox_provider_unique" ON "email_messages" USING btree ("mailbox_id","provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_messages_tracking_unique" ON "email_messages" USING btree ("tracking_id");--> statement-breakpoint
CREATE INDEX "email_templates_owner_idx" ON "email_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "email_templates_category_idx" ON "email_templates" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "email_templates_owner_name_unique" ON "email_templates" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "email_threads_owner_idx" ON "email_threads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "email_threads_mailbox_idx" ON "email_threads" USING btree ("mailbox_id");--> statement-breakpoint
CREATE INDEX "email_threads_person_idx" ON "email_threads" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "email_threads_org_idx" ON "email_threads" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "email_threads_deal_idx" ON "email_threads" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "email_threads_last_message_idx" ON "email_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_threads_mailbox_provider_unique" ON "email_threads" USING btree ("mailbox_id","provider_thread_id");--> statement-breakpoint
CREATE INDEX "mailboxes_owner_idx" ON "mailboxes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "mailboxes_provider_idx" ON "mailboxes" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "mailboxes_status_idx" ON "mailboxes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mailboxes_account_idx" ON "mailboxes" USING btree ("account_provider","account_provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mailboxes_owner_provider_email_unique" ON "mailboxes" USING btree ("owner_id","provider","email_normalized");