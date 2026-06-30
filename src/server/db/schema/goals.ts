/**
 * Objetivos (goals) y seguimiento (Fase 9.5). Cada objetivo define una meta medible
 * para un periodo recurrente (mes o trimestre); el progreso del periodo en curso se
 * calcula al vuelo desde negocios, actividades y eventos de email.
 */
import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export type GoalMetric =
  | "revenue_won"
  | "deals_won"
  | "deals_created"
  | "activities_completed"
  | "emails_sent";

export type GoalPeriod = "month" | "quarter";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    metric: text("metric").$type<GoalMetric>().notNull(),
    period: text("period").$type<GoalPeriod>().default("month").notNull(),
    target: doublePrecision("target").default(0).notNull(),
    ...timestamps,
  },
  (t) => [index("goals_owner_idx").on(t.ownerId)],
);

export const goalsRelations = relations(goals, ({ one }) => ({
  owner: one(users, { fields: [goals.ownerId], references: [users.id] }),
}));
