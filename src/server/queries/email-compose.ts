import "server-only";

import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
} from "drizzle-orm";

import { buildMergeCatalog, buildMergeContext } from "@/lib/email/merge-tags";
import { fullName } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  deals,
  organizations,
  persons,
  pipelines,
  stages,
} from "@/server/db/schema";
import { listAllCustomFieldDefsForOwner } from "@/server/queries/custom-fields";
import type {
  EmailComposerDealOption,
  EmailComposerRecipient,
} from "@/components/email/send-email-dialog";

export type EmailComposeData = {
  catalog: ReturnType<typeof buildMergeCatalog>;
  dealOptions: EmailComposerDealOption[];
  recipients: EmailComposerRecipient[];
};

function linkedDealCondition(
  personIds: string[],
  orgIds: string[],
): SQL | undefined {
  const conditions: SQL[] = [];
  if (personIds.length > 0) conditions.push(inArray(deals.personId, personIds));
  if (orgIds.length > 0) conditions.push(inArray(deals.orgId, orgIds));
  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : or(...conditions);
}

export async function getEmailComposeData(): Promise<EmailComposeData> {
  const user = await requireUser();
  const customFieldDefs = await listAllCustomFieldDefsForOwner(user.id);

  const personRows = await db
    .select({
      campaign: persons.campaign,
      email: persons.email,
      firstName: persons.firstName,
      id: persons.id,
      lastName: persons.lastName,
      orgCustomFields: organizations.customFields,
      orgId: organizations.id,
      orgIndustry: organizations.industry,
      orgName: organizations.name,
      orgTradeName: organizations.tradeName,
      orgWebsite: organizations.website,
      personCustomFields: persons.customFields,
      phone: persons.phone,
      title: persons.title,
    })
    .from(persons)
    .leftJoin(
      organizations,
      and(
        eq(persons.orgId, organizations.id),
        isNull(organizations.deletedAt),
      ),
    )
    .where(
      and(
        eq(persons.ownerId, user.id),
        isNull(persons.deletedAt),
        isNotNull(persons.email),
        ne(persons.email, ""),
      ),
    )
    .orderBy(asc(persons.firstName), asc(persons.lastName), asc(persons.email))
    .limit(1_000);

  const recipients = personRows.flatMap<EmailComposerRecipient>((row) => {
    if (!row.email) return [];
    const name = fullName(row.firstName, row.lastName) || row.email;
    const org =
      row.orgId && row.orgName
        ? {
            customFields: row.orgCustomFields,
            industry: row.orgIndustry,
            name: row.orgName,
            tradeName: row.orgTradeName,
            website: row.orgWebsite,
          }
        : null;

    return [
      {
        context: buildMergeContext(
          {
            campaign: row.campaign,
            customFields: row.personCustomFields,
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            title: row.title,
          },
          org,
          customFieldDefs.person,
          customFieldDefs.organization,
        ),
        email: row.email,
        id: row.id,
        name,
        orgId: row.orgId ?? undefined,
        personId: row.id,
      },
    ];
  });

  const personIds = recipients.flatMap((recipient) =>
    recipient.personId ? [recipient.personId] : [],
  );
  const orgIds = Array.from(
    new Set(
      recipients.flatMap((recipient) =>
        recipient.orgId ? [recipient.orgId] : [],
      ),
    ),
  );

  const linkCondition = linkedDealCondition(personIds, orgIds);
  const dealOptions = linkCondition
    ? await db
        .select({
          id: deals.id,
          orgId: deals.orgId,
          personId: deals.personId,
          pipelineName: pipelines.name,
          stageName: stages.name,
          title: deals.title,
        })
        .from(deals)
        .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
        .innerJoin(stages, eq(deals.stageId, stages.id))
        .where(
          and(
            eq(deals.ownerId, user.id),
            eq(deals.status, "open"),
            isNull(deals.deletedAt),
            linkCondition,
          ),
        )
        .orderBy(desc(deals.updatedAt), desc(deals.createdAt))
        .limit(1_000)
    : [];

  return {
    catalog: buildMergeCatalog(
      customFieldDefs.person,
      customFieldDefs.organization,
      recipients.some((recipient) => Boolean(recipient.orgId)),
    ),
    dealOptions,
    recipients,
  };
}
