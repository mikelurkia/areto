import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
import { MembershipTable } from "@/components/equipos/membership-table";
import { SectionHeading } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";

type MembershipItem = {
  id: string;
  role: "player" | "coach" | "staff";
  position: string | null;
  jerseyNumber: number | null;
  positions: string[];
  isCaptain: boolean;
  installmentsCount: number | null;
  team: { id: string; name: string; playerFeePeriod: string };
};

type SeasonGroup = {
  season: { id: string; name: string; isCurrent: boolean };
  items: MembershipItem[];
};

type PersonTeamsTabProps = {
  personId: string;
  personName: string;
  canManage: boolean;
  availableTeamOptions: { id: string; label: string }[];
  seasonGroups: SeasonGroup[];
  federationCardUrls: Map<string, string>;
};

/** Pestaña "Equipos" de la ficha de persona: membresías agrupadas por temporada. */
export async function PersonTeamsTab({
  personId,
  personName,
  canManage,
  availableTeamOptions,
  seasonGroups,
  federationCardUrls,
}: PersonTeamsTabProps) {
  const t = await getTranslations("Personas");
  const tEquipos = await getTranslations("Equipos");

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title={t("teamsSection")}
        actions={
          canManage && availableTeamOptions.length > 0 ? (
            <MembershipDialog
              mode="create-person"
              personId={personId}
              personName={personName}
              availableTeams={availableTeamOptions}
            />
          ) : null
        }
      />
      {seasonGroups.length === 0 ? (
        <SectionPlaceholder size="compact" title={t("noTeamsDescription")} />
      ) : (
        seasonGroups.map(({ season, items }) => (
          <div key={season.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{season.name}</h3>
              {season.isCurrent ? <Badge>{tEquipos("currentBadge")}</Badge> : null}
            </div>
            <MembershipTable
              items={items.map((m) => ({
                ...m,
                federationCardUrl: federationCardUrls.get(m.id) ?? null,
                installmentsMode: m.team.playerFeePeriod === "installments",
              }))}
              canManage={canManage}
              t={tEquipos}
              subjectHeader={t("colTeam")}
              nameFor={() => personName}
              renderSubject={(m) => (
                <span className="flex items-center gap-2">
                  <Link
                    href={`/equipos/${m.team.id}?from=${encodeURIComponent(`/personas/${personId}`)}&fromLabel=${encodeURIComponent(personName)}`}
                    className="hover:underline"
                  >
                    {m.team.name}
                  </Link>
                  {m.isCaptain ? (
                    <Badge variant="outline" title={tEquipos("captainLabel")}>
                      {tEquipos("captainShort")}
                    </Badge>
                  ) : null}
                </span>
              )}
            />
          </div>
        ))
      )}
    </div>
  );
}
