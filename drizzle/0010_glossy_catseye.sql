ALTER TABLE "persons" ADD COLUMN "campaign" text;--> statement-breakpoint
CREATE INDEX "persons_campaign_idx" ON "persons" USING btree ("owner_id","campaign");
--> statement-breakpoint
CREATE INDEX "persons_campaign_lower_idx" ON "persons" USING btree ("owner_id",lower("campaign"));
