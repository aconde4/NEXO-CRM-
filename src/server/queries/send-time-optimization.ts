import "server-only";

import { requireUser } from "@/lib/session";
import { getPersonSendTimeAdviceForOwner } from "@/server/services/send-time-optimization";

export async function getPersonSendTimeAdvice(personId: string) {
  const user = await requireUser();
  return getPersonSendTimeAdviceForOwner(user.id, personId);
}
