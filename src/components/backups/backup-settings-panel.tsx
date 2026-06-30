import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Download,
  HardDrive,
} from "lucide-react";

import { formatBytes, formatDateTime } from "@/lib/format";
import type {
  BackupExportListItem,
  BackupRuntimeStatus,
} from "@/server/services/backups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function totalRows(tableCounts: Record<string, number>) {
  return Object.values(tableCounts).reduce((sum, value) => sum + value, 0);
}

function shortChecksum(value: string | null) {
  return value ? `${value.slice(0, 10)}...` : "-";
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant={ok ? "secondary" : "outline"}
      className={
        ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : ""
      }
    >
      {ok ? <CheckCircle2 className="size-3.5" /> : null}
      {label}
    </Badge>
  );
}

export function BackupSettingsPanel({
  exports,
  runtime,
}: {
  exports: BackupExportListItem[];
  runtime: BackupRuntimeStatus;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseBackup className="text-muted-foreground size-4" />
              Copias de seguridad
            </CardTitle>
            <CardDescription>
              Exportación completa en JSON y copia programada en Storage privado.
            </CardDescription>
          </div>
          <Button render={<Link href="/api/backups/export" />}>
            <Download className="size-4" />
            Descargar JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">Storage</p>
              <HardDrive className="text-muted-foreground size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-medium">
              Bucket {runtime.storageBucket}
            </p>
            <div className="mt-2">
              <StatusBadge
                ok={runtime.storageConfigured}
                label={runtime.storageConfigured ? "Configurado" : "Pendiente"}
              />
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">Cron</p>
              <Clock3 className="text-muted-foreground size-4" />
            </div>
            <p className="mt-1 text-sm font-medium">
              Endpoint /api/backups/scheduled
            </p>
            <div className="mt-2">
              <StatusBadge
                ok={runtime.cronSecretConfigured}
                label={runtime.cronSecretConfigured ? "Protegido" : "Sin secreto"}
              />
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">Programación</p>
              {runtime.scheduledReady ? (
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="text-muted-foreground size-4" />
              )}
            </div>
            <p className="mt-1 text-sm font-medium">
              {runtime.scheduledReady ? "Lista para ejecutar" : "Requiere configuración"}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              {runtime.ownerEmailConfigured
                ? "Propietario resuelto por entorno."
                : "Define BACKUP_OWNER_EMAIL o ALLOWED_EMAILS."}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Últimas exportaciones</p>
          {exports.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aún no hay copias registradas.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Tamaño</TableHead>
                    <TableHead className="text-right">Filas</TableHead>
                    <TableHead>Checksum</TableHead>
                    <TableHead className="text-right">Archivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell>{formatDateTime(backup.createdAt)}</TableCell>
                      <TableCell>
                        {backup.kind === "scheduled" ? "Programada" : "Manual"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            backup.status === "failed"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {backup.status === "failed" ? "Error" : "Completada"}
                        </Badge>
                        {backup.error ? (
                          <p className="text-destructive mt-1 max-w-72 truncate text-xs">
                            {backup.error}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBytes(backup.bytes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totalRows(backup.tableCounts)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {shortChecksum(backup.checksumSha256)}
                      </TableCell>
                      <TableCell className="text-right">
                        {backup.storagePath ? (
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <Link href={`/api/backups/${backup.id}/download`} />
                            }
                          >
                            <Download className="size-3.5" />
                            Descargar
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
