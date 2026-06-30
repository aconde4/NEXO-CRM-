"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  type GoalFormValues,
  goalFormSchema,
  goalIdSchema,
} from "@/lib/validations/goal";
import { db } from "@/server/db";
import { goals } from "@/server/db/schema";

function revalidateGoals() {
  revalidatePath("/analytics/goals");
}

export async function saveGoal(raw: GoalFormValues) {
  const user = await requireUser();
  const data = goalFormSchema.parse(raw);

  const values = {
    metric: data.metric,
    name: data.name.trim() ? data.name.trim() : null,
    period: data.period,
    target: data.target,
  };

  if (data.id) {
    await db
      .update(goals)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(goals.id, data.id), eq(goals.ownerId, user.id)));
    revalidateGoals();
    return { id: data.id };
  }

  const [created] = await db
    .insert(goals)
    .values({ ...values, ownerId: user.id })
    .returning({ id: goals.id });
  revalidateGoals();
  return { id: created?.id };
}

export async function deleteGoal(id: string) {
  const user = await requireUser();
  const goalId = goalIdSchema.parse(id);
  await db
    .delete(goals)
    .where(and(eq(goals.id, goalId), eq(goals.ownerId, user.id)));
  revalidateGoals();
  return { id: goalId };
}
