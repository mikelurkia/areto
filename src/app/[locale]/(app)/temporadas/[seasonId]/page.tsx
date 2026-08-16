import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckIcon,
  ClipboardListIcon,
  PaperclipIcon,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";

import { db } from "@/db";
import { seasonTasks, seasons, teams } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSignedUrls } from "@/lib/supabase/storage";
import {
  SEASON_TASK_KINDS,
  computeFederationRollup,
  computeSeasonTaskProgress,
  type SeasonTaskKind,
  type SeasonTaskStatus,
} from "@/lib/season-tasks";
import { Link } from "@/i18n/navigation";
import { GenerateTasksDialog } from "@/components/temporada/generate-tasks-dialog";
import { TaskDialog } from "@/components/temporada/task-dialog";
import { DeleteTaskDialog } from "@/components/temporada/delete-task-dialog";
import { TaskStatusToggle } from "@/components/temporada/task-status-toggle";
import { FederationToggle } from "@/components/temporada/federation-toggle";
import { RegisterAllButton } from "@/components/temporada/register-all-button";
import { DeleteSeasonDialog, SeasonDialog } from "@/components/temporada/season-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PROOF_BUCKET = "season-task-proofs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) });
  return { title: season?.name ?? "Areto" };
}

export default async function TemporadaDetailPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;
  const user = await requireUser();
  const t = await getTranslations("Temporadas");
  const locale = await getLocale();
  const canManage = user.role === "admin" || user.role === "staff";

  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) });
  if (!season) notFound();

  const [tasks, seasonTeams] = await Promise.all([
    db.query.seasonTasks.findMany({
      where: eq(seasonTasks.seasonId, season.id),
      orderBy: (tk, { asc }) => [asc(tk.sortOrder), asc(tk.createdAt)],
    }),
    db.query.teams.findMany({
      where: eq(teams.seasonId, season.id),
      orderBy: (tm, { asc }) => [asc(tm.category), asc(tm.name)],
      with: {
        memberships: {
          with: { person: { columns: { firstName: true, lastName: true } } },
        },
      },
    }),
  ]);

  // URLs firmadas de justificantes/documentación.
  const [proofUrls, docUrls] = await Promise.all([
    getSignedUrls(PROOF_BUCKET, tasks, (t) => t.proofPath, (t) => t.id),
    getSignedUrls(PROOF_BUCKET, tasks, (t) => t.docPath, (t) => t.id),
  ]);

  const teamOptions = seasonTeams.map((tm) => ({ id: tm.id, label: tm.name }));
  const teamById = new Map(seasonTeams.map((tm) => [tm.id, tm]));

  const progress = computeSeasonTaskProgress(tasks);
  const currencyFmt = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const today = new Date().toISOString().slice(0, 10);
  const fmtDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00`));

  // Agrupación: un grupo por equipo (en orden) y un grupo "Club" para teamId nulo.
  type Task = (typeof tasks)[number];
  const clubTasks = tasks.filter((tk) => tk.teamId === null);
  const groups: { key: string; label: string; teamId: string | null; tasks: Task[] }[] = [];
  for (const tm of seasonTeams) {
    const teamTasks = tasks.filter((tk) => tk.teamId === tm.id);
    if (teamTasks.length > 0) {
      groups.push({ key: tm.id, label: tm.name, teamId: tm.id, tasks: teamTasks });
    }
  }
  if (clubTasks.length > 0) {
    groups.push({ key: "club", label: t("clubGroup"), teamId: null, tasks: clubTasks });
  }

  function statusBadgeVariant(status: SeasonTaskStatus) {
    return status === "done" ? "secondary" : status === "in_progress" ? "outline" : "outline";
  }

  function renderTask(task: Task) {
    const meta = SEASON_TASK_KINDS[task.kind as SeasonTaskKind];
    const overdue = task.dueDate !== null && task.dueDate < today && task.status !== "done";
    const proofUrl = proofUrls.get(task.id) ?? null;
    const docUrl = docUrls.get(task.id) ?? null;

    // Rollup de inscripción de jugadores para el trámite paraguas.
    const team = task.teamId ? teamById.get(task.teamId) : null;
    const rollup =
      meta.rollsUpPlayers && team ? computeFederationRollup(team.memberships) : null;
    const players =
      meta.rollsUpPlayers && team
        ? team.memberships
            .filter((m) => m.active && m.role === "player")
            .sort((a, b) =>
              `${a.person.lastName} ${a.person.firstName}`.localeCompare(
                `${b.person.lastName} ${b.person.firstName}`,
                locale,
              ),
            )
        : [];

    return (
      <div key={task.id} className="flex flex-col gap-2 border-b py-3 last:border-b-0">
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <TaskStatusToggle id={task.id} status={task.status as SeasonTaskStatus} />
          ) : (
            <Badge variant={statusBadgeVariant(task.status as SeasonTaskStatus)}>
              {t(`status.${task.status}`)}
            </Badge>
          )}
          <span
            className={
              task.status === "done"
                ? "font-medium text-muted-foreground line-through"
                : "font-medium"
            }
          >
            {task.title}
          </span>

          {task.dueDate ? (
            <Badge variant={overdue ? "destructive" : "secondary"} className="gap-1">
              <CalendarClockIcon className="size-3" />
              {overdue ? t("overdueBadge", { date: fmtDate(task.dueDate) }) : fmtDate(task.dueDate)}
            </Badge>
          ) : null}

          {meta.hasPayment && task.amountCents !== null ? (
            <Badge variant={task.paidOn ? "secondary" : "outline"} className="gap-1">
              {currencyFmt.format(task.amountCents / 100)}
              {task.paidOn ? (
                <>
                  <CheckIcon className="size-3" />
                  {t("paidOn", { date: fmtDate(task.paidOn) })}
                </>
              ) : (
                <span className="text-muted-foreground">· {t("unpaid")}</span>
              )}
            </Badge>
          ) : null}

          {proofUrl ? (
            <a
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <PaperclipIcon className="size-3" />
              {t("viewProof")}
            </a>
          ) : null}
          {docUrl ? (
            <a
              href={docUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <PaperclipIcon className="size-3" />
              {t("viewDoc")}
            </a>
          ) : null}

          {rollup ? (
            <Badge
              variant={rollup.registered === rollup.total && rollup.total > 0 ? "secondary" : "outline"}
            >
              {t("rollup", { registered: rollup.registered, total: rollup.total })}
            </Badge>
          ) : null}

          {canManage ? (
            <div className="ml-auto flex items-center gap-1">
              <TaskDialog
                mode="edit"
                teamOptions={teamOptions}
                proofUrl={proofUrl}
                docUrl={docUrl}
                task={{
                  id: task.id,
                  teamId: task.teamId,
                  kind: task.kind as SeasonTaskKind,
                  title: task.title,
                  status: task.status as SeasonTaskStatus,
                  dueDate: task.dueDate,
                  amountCents: task.amountCents,
                  paidOn: task.paidOn,
                  assignee: task.assignee,
                  notes: task.notes,
                  hasProof: task.proofPath !== null,
                  hasDoc: task.docPath !== null,
                }}
              />
              <DeleteTaskDialog id={task.id} title={task.title} />
            </div>
          ) : null}
        </div>

        {task.assignee || task.notes ? (
          <p className="text-sm text-muted-foreground">
            {task.assignee ? <span className="font-medium">{task.assignee}</span> : null}
            {task.assignee && task.notes ? " · " : null}
            {task.notes}
          </p>
        ) : null}

        {rollup && canManage ? (
          <details className="rounded-md bg-muted/40 px-3 py-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {t("rosterSummary", { registered: rollup.registered, total: rollup.total })}
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              {players.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noPlayers")}</p>
              ) : (
                players.map((m) => {
                  const name = `${m.person.firstName} ${m.person.lastName}`;
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <FederationToggle
                        membershipId={m.id}
                        registered={m.federationRegistered}
                        label={name}
                      />
                      {name}
                    </label>
                  );
                })
              )}
              {team ? (
                <div className="mt-2">
                  <RegisterAllButton teamId={team.id} />
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  const starts = season.startsOn ? fmtDate(season.startsOn) : null;
  const ends = season.endsOn ? fmtDate(season.endsOn) : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Link
          href="/temporadas"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("backToSeasons")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{season.name}</h1>
              {season.isCurrent ? <Badge variant="secondary">{t("currentBadge")}</Badge> : null}
            </div>
            <p className="text-muted-foreground">
              {starts || ends ? `${starts ?? "—"} – ${ends ?? "—"} · ` : ""}
              {t("fichaSubtitle")}
            </p>
          </div>
          {canManage ? (
            <div className="flex items-center gap-1">
              <SeasonDialog mode="edit" season={season} />
              <DeleteSeasonDialog id={season.id} name={season.name} />
            </div>
          ) : null}
        </div>
      </div>

      {tasks.length === 0 ? (
        <SectionPlaceholder
          icon={ClipboardListIcon}
          title={t("emptyTitle")}
          description={canManage ? t("emptyDescription") : t("emptyReadonly")}
        >
          {canManage ? (
            <div className="flex flex-wrap justify-center gap-2">
              <GenerateTasksDialog seasonId={season.id} />
              <TaskDialog mode="create" seasonId={season.id} teamOptions={teamOptions} />
            </div>
          ) : null}
        </SectionPlaceholder>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
              <ProgressStat
                label={t("progressDone")}
                value={`${progress.done}/${progress.total}`}
              />
              <ProgressStat
                label={t("progressUnpaid")}
                value={`${currencyFmt.format(progress.unpaidCents / 100)}`}
                hint={t("progressUnpaidHint", { count: progress.unpaid })}
              />
              {canManage ? (
                <div className="ml-auto flex flex-wrap gap-2">
                  <GenerateTasksDialog seasonId={season.id} />
                  <TaskDialog mode="create" seasonId={season.id} teamOptions={teamOptions} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {groups.map((group) => (
            <Card key={group.key}>
              <CardHeader>
                <CardTitle className="text-base">{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">{group.tasks.map(renderTask)}</CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function ProgressStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
