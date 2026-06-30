CREATE TABLE "backup_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"format" text DEFAULT 'json' NOT NULL,
	"file_name" text,
	"storage_bucket" text,
	"storage_path" text,
	"bytes" integer DEFAULT 0 NOT NULL,
	"checksum_sha256" text,
	"table_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "backup_exports" ADD CONSTRAINT "backup_exports_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_exports_owner_idx" ON "backup_exports" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "backup_exports_status_idx" ON "backup_exports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backup_exports_created_idx" ON "backup_exports" USING btree ("created_at");