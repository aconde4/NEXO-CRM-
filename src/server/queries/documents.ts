import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type DocumentStatus,
  deals,
  documents,
  users,
} from "@/server/db/schema";

export type DocumentListItem = {
  id: string;
  title: string;
  status: DocumentStatus;
  token: string | null;
  signerEmail: string | null;
  signerName: string | null;
  signedAt: string | null;
  dealId: string | null;
  dealTitle: string | null;
  body: string;
  createdAt: string;
};

export async function listDocuments(): Promise<DocumentListItem[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      body: documents.body,
      createdAt: documents.createdAt,
      dealId: documents.dealId,
      dealTitle: deals.title,
      id: documents.id,
      signedAt: documents.signedAt,
      signerEmail: documents.signerEmail,
      signerName: documents.signerName,
      status: documents.status,
      title: documents.title,
      token: documents.token,
    })
    .from(documents)
    .leftJoin(deals, eq(documents.dealId, deals.id))
    .where(eq(documents.ownerId, user.id))
    .orderBy(desc(documents.createdAt));
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    signedAt: row.signedAt ? row.signedAt.toISOString() : null,
  }));
}

export async function listDealOptionsForDocuments(): Promise<
  { id: string; title: string }[]
> {
  const user = await requireUser();
  return db
    .select({ id: deals.id, title: deals.title })
    .from(deals)
    .where(and(eq(deals.ownerId, user.id), isNull(deals.deletedAt)))
    .orderBy(desc(deals.createdAt))
    .limit(500);
}

export type PublicDocument = {
  title: string;
  body: string;
  status: DocumentStatus;
  signerName: string | null;
  signedAt: string | null;
  ownerName: string | null;
};

export async function getDocumentByToken(
  token: string,
): Promise<PublicDocument | null> {
  const [row] = await db
    .select({
      body: documents.body,
      ownerName: users.name,
      signedAt: documents.signedAt,
      signerName: documents.signerName,
      status: documents.status,
      title: documents.title,
    })
    .from(documents)
    .leftJoin(users, eq(documents.ownerId, users.id))
    .where(eq(documents.token, token))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    signedAt: row.signedAt ? row.signedAt.toISOString() : null,
  };
}
