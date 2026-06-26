ALTER TABLE "email_messages" ADD COLUMN "sentiment" text;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "sentiment_at" timestamp with time zone;