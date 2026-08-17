import {
  ArrowRightIcon,
  MailIcon,
  PhoneIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export type FamilyMember = {
  id: string;
  name: string;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  ageYears: number | null;
  isMinor: boolean;
};

type FamilyPanelProps = {
  guardians: FamilyMember[];
  siblings: FamilyMember[];
  dependents: FamilyMember[];
  minorWithoutGuardian: boolean;
  minorGuardian: boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

async function MemberCard({ member }: { member: FamilyMember }) {
  const t = await getTranslations("Personas");
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Avatar>
        {member.photoUrl ? <AvatarImage src={member.photoUrl} alt="" /> : null}
        <AvatarFallback>
          {initials(member.name) || <UserRoundIcon className="size-4" />}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/personas/${member.id}`}
            className="font-medium hover:underline"
          >
            {member.name}
          </Link>
          {member.ageYears != null ? (
            <span className="text-xs text-muted-foreground">
              {t("ageYears", { count: member.ageYears })}
            </span>
          ) : null}
          {member.isMinor ? (
            <Badge variant="outline" className="text-xs">
              {t("minorTag")}
            </Badge>
          ) : null}
        </div>
        {member.phone || member.email ? (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
            {member.phone ? (
              <a
                href={`tel:${member.phone}`}
                className="flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <PhoneIcon className="size-3.5" />
                {member.phone}
              </a>
            ) : null}
            {member.email ? (
              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <MailIcon className="size-3.5" />
                {member.email}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <Link
        href={`/personas/${member.id}`}
        className="shrink-0 text-muted-foreground hover:text-foreground print:hidden"
        aria-label={t("viewProfileSr", { name: member.name })}
      >
        <ArrowRightIcon className="size-4" />
      </Link>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

export async function FamilyPanel({
  guardians,
  siblings,
  dependents,
  minorWithoutGuardian,
  minorGuardian,
}: FamilyPanelProps) {
  const t = await getTranslations("Personas");
  const isEmpty = guardians.length === 0 && siblings.length === 0 && dependents.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {minorWithoutGuardian || minorGuardian ? (
        <div className="flex flex-col gap-2">
          {minorWithoutGuardian ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <span>{t("minorWithoutGuardianWarning")}</span>
            </div>
          ) : null}
          {minorGuardian ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <span>{t("minorGuardianWarning")}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <SectionTitle>{t("guardianLabel")}</SectionTitle>
        {guardians.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {guardians.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("guardianNone")}</p>
        )}
      </div>

      {siblings.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SectionTitle>{t("siblingsSection")}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {siblings.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      ) : null}

      {dependents.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SectionTitle>{t("dependentsLabel")}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {dependents.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {isEmpty ? `${t("noFamilyDescription")} ` : null}
        {t("editGuardianHint")}
      </p>
    </div>
  );
}
