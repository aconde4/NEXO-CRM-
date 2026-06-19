"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Handshake,
  Inbox,
  Mail,
  MailOpen,
  Search,
  User,
  X,
} from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  InboxThreadFilter,
  InboxThreadItem,
  InboxThreadSort,
  InboxThreadStats,
} from "@/server/queries/email-threads";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 shrink-0 rounded-lg border bg-transparent px-2.5 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const FILTER_OPTIONS: { value: InboxThreadFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "unread", label: "No leidos" },
  { value: "linked", label: "Vinculados" },
  { value: "unlinked", label: "Sin vincular" },
];

const SORT_OPTIONS: { value: InboxThreadSort; label: string }[] = [
  { value: "recent", label: "Recientes" },
  { value: "oldest", label: "Mas antiguos" },
];

const statusLabels = {
  active: "Activo",
  archived: "Archivado",
  spam: "Spam",
  trash: "Papelera",
} as const;

type InboxFilters = {
  filter: InboxThreadFilter;
  query: string;
  sort: InboxThreadSort;
};

export function InboxThreadsView({
  filters,
  stats,
  threads,
}: {
  filters: InboxFilters;
  stats: InboxThreadStats;
  threads: InboxThreadItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(filters.query);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function replaceParams(next: {
    filter?: InboxThreadFilter;
    q?: string;
    sort?: InboxThreadSort;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (params.get("filter") === "all") params.delete("filter");
    if (params.get("sort") === "recent") params.delete("sort");
    router.replace(`/inbox${params.size ? `?${params}` : ""}`);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => replaceParams({ q: value }), 250);
  }

  function clearSearch() {
    setSearch("");
    if (timer.current) clearTimeout(timer.current);
    replaceParams({ q: "" });
  }

  const hasFilter =
    Boolean(filters.query) ||
    filters.filter !== "all" ||
    filters.sort !== "recent";

  return (
    <section className="space-y-4" aria-labelledby="inbox-heading">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 id="inbox-heading" className="text-xl font-semibold">
            Conversaciones
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {threads.length} de {stats.total}{" "}
            {stats.total === 1 ? "hilo sincronizado" : "hilos sincronizados"}.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar asunto, contacto, empresa..."
              className="pr-9 pl-9"
            />
            {search ? (
              <button
                type="button"
                onClick={clearSearch}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition"
                aria-label="Limpiar busqueda"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <select
            className={selectClass}
            value={filters.filter}
            onChange={(event) =>
              replaceParams({
                filter: event.target.value as InboxThreadFilter,
              })
            }
            aria-label="Filtro de conversaciones"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            value={filters.sort}
            onChange={(event) =>
              replaceParams({ sort: event.target.value as InboxThreadSort })
            }
            aria-label="Orden de conversaciones"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Metric label="Total" value={stats.total} />
        <Metric label="No leidos" value={stats.unread} />
        <Metric label="Vinculados" value={stats.linked} />
        <Metric label="Sin vincular" value={stats.unlinked} />
      </div>

      {threads.length === 0 ? (
        <EmptyState hasFilter={hasFilter} />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <ul className="divide-y">
            {threads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ThreadRow({ thread }: { thread: InboxThreadItem }) {
  const latest = thread.latestMessage;
  const outbound = latest?.direction === "outbound";
  const participant = latest
    ? outbound
      ? `Para: ${recipientsLabel(latest.toRecipients)}`
      : `De: ${latest.fromName || latest.fromEmail}`
    : thread.mailboxEmail;
  const hasLink = Boolean(thread.person || thread.organization || thread.deal);

  return (
    <li
      className={cn(
        "hover:bg-muted/30 transition-colors",
        thread.unread && "bg-primary/5",
      )}
    >
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-center">
        <Link href={`/inbox/${thread.id}`} className="min-w-0">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {thread.unread ? (
                <Mail className="text-primary size-4" />
              ) : (
                <MailOpen className="text-muted-foreground size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "min-w-0 truncate text-sm",
                    thread.unread ? "font-semibold" : "font-medium",
                  )}
                >
                  {thread.subject || "(sin asunto)"}
                </p>
                {thread.unread ? <Badge>No leido</Badge> : null}
                {thread.status !== "active" ? (
                  <Badge variant="outline">{statusLabels[thread.status]}</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {participant}
              </p>
              {thread.snippet ? (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                  {thread.snippet}
                </p>
              ) : null}
              <ThreadLinks thread={thread} />
            </div>
          </div>
        </Link>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs lg:block lg:text-right">
          <p className="tabular-nums">
            {formatDateTime(thread.lastMessageAt ?? latest?.at)}
          </p>
          <p>
            {thread.messageCount}{" "}
            {thread.messageCount === 1 ? "mensaje" : "mensajes"}
          </p>
          <p className="inline-flex items-center gap-1 lg:justify-end">
            {outbound ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownLeft className="size-3.5" />
            )}
            {outbound ? "Saliente" : "Entrante"}
          </p>
          {!hasLink ? <p>Sin vincular</p> : null}
        </div>
      </div>
    </li>
  );
}

function ThreadLinks({ thread }: { thread: InboxThreadItem }) {
  if (!thread.person && !thread.organization && !thread.deal) return null;
  return (
    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
      {thread.person ? (
        <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5">
          <User className="size-3" />
          {thread.person.name || thread.person.email || "Contacto"}
        </span>
      ) : null}
      {thread.organization ? (
        <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5">
          <Building2 className="size-3" />
          {thread.organization.name}
        </span>
      ) : null}
      {thread.deal ? (
        <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5">
          <Handshake className="size-3" />
          {thread.deal.title}
        </span>
      ) : null}
    </div>
  );
}

function recipientsLabel(
  recipients: { email: string; name?: string | null }[],
) {
  if (recipients.length === 0) return "(sin destinatario)";
  const names = recipients.slice(0, 2).map((recipient) => {
    return recipient.name || recipient.email;
  });
  const suffix = recipients.length > 2 ? ` +${recipients.length - 2}` : "";
  return `${names.join(", ")}${suffix}`;
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
        <Inbox className="size-6" />
      </div>
      <h3 className="font-medium">
        {hasFilter ? "Sin conversaciones con esos filtros" : "Bandeja vacia"}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {hasFilter
          ? "Prueba con otra busqueda o cambia el filtro."
          : "Sincroniza Gmail para traer los ultimos hilos de entrada."}
      </p>
    </div>
  );
}
