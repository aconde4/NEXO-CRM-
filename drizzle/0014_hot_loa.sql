ALTER TABLE "deals" ADD COLUMN "next_best_action" jsonb;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "next_best_action_at" timestamp with time zone;