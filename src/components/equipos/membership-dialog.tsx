"use client";

import { useActionState, useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addMembership,
  updateMembership,
} from "@/app/[locale]/(app)/equipos/[teamId]/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

const MEMBERSHIP_ROLES = ["player", "coach", "staff"] as const;
const PLAYER_POSITIONS = ["cierre", "ala", "pivot", "portero"] as const;

type PersonOption = { id: string; firstName: string; lastName: string };
type TeamOption = { id: string; label: string };

type Membership = {
  id: string;
  personName: string;
  role: (typeof MEMBERSHIP_ROLES)[number];
  jerseyNumber: number | null;
  positions: string[];
  isCaptain: boolean;
  position: string | null;
};

type MembershipDialogProps = (
  | { mode: "create"; teamId: string; availablePersons: PersonOption[] }
  | {
      mode: "create-person";
      personId: string;
      personName: string;
      availableTeams: TeamOption[];
    }
  | { mode: "edit"; membership: Membership }
) & {
  /** Dorsales ya ocupados en el equipo, para el mapa de dorsales (contexto equipo). */
  takenJerseys?: number[];
};

export function MembershipDialog(props: MembershipDialogProps) {
  const t = useTranslations("Equipos");
  const isCreate = props.mode === "create" || props.mode === "create-person";
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    isCreate ? addMembership : updateMembership,
    {},
  );
  useActionToast(state.message);
  useCloseOnActionSuccess(state, setOpen);

  const membership = useFrozenWhileOpen(
    open,
    props.mode === "edit" ? props.membership : null,
  );

  // Siembra el dorsal desde la membership al abrir. Ajuste de estado en render
  // (patrón recomendado de React) en vez de un efecto con setState.
  const [jersey, setJersey] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setJersey(
        props.mode === "edit" && props.membership.jerseyNumber !== null
          ? String(props.membership.jerseyNumber)
          : "",
      );
    }
  }

  // El mapa de dorsales solo aparece en contexto de equipo (cuando se pasa la
  // prop, aunque sea un array vacío); desde la ficha de persona no.
  const showJerseyMap = props.takenJerseys !== undefined;
  const takenJerseys = props.takenJerseys ?? [];
  const takenSet = new Set(takenJerseys);
  const maxJersey = Math.max(20, ...takenJerseys, Number(jersey) || 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isCreate ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {props.mode === "create-person"
            ? t("addToTeamAction")
            : t("addMemberAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editMemberSr", { name: membership!.personName })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create-person"
              ? t("addToTeamTitle")
              : isCreate
                ? t("addMemberTitle")
                : t("editMemberTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          {props.mode === "create" ? (
            <input type="hidden" name="teamId" value={props.teamId} />
          ) : props.mode === "create-person" ? (
            <input type="hidden" name="personId" value={props.personId} />
          ) : (
            <input type="hidden" name="id" value={membership!.id} />
          )}
          <FieldGroup>
            {props.mode === "create" ? (
              <Field>
                <FieldLabel htmlFor="membership-person">
                  {t("personLabel")}
                </FieldLabel>
                <Select name="personId">
                  <SelectTrigger id="membership-person" className="w-full">
                    <SelectValue placeholder={t("selectPerson")}>
                      {(value: string) => {
                        const person = props.availablePersons.find(
                          (p) => p.id === value,
                        );
                        return person
                          ? `${person.firstName} ${person.lastName}`
                          : t("selectPerson");
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {props.availablePersons.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : props.mode === "create-person" ? (
              <Field>
                <FieldLabel htmlFor="membership-team">{t("teamLabel")}</FieldLabel>
                <Select name="teamId">
                  <SelectTrigger id="membership-team" className="w-full">
                    <SelectValue placeholder={t("selectTeam")}>
                      {(value: string) =>
                        props.availableTeams.find((team) => team.id === value)
                          ?.label ?? t("selectTeam")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {props.availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field>
                <FieldLabel>{t("personLabel")}</FieldLabel>
                <p className="text-sm font-medium">{membership!.personName}</p>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="membership-role">{t("roleLabel")}</FieldLabel>
                <Select
                  name="role"
                  defaultValue={membership?.role ?? "player"}
                >
                  <SelectTrigger id="membership-role" className="w-full">
                    <SelectValue>
                      {(value: string) => t(`roleOption.${value}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBERSHIP_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`roleOption.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="membership-jersey">
                  {t("jerseyNumberLabel")}
                </FieldLabel>
                <Input
                  id="membership-jersey"
                  name="jerseyNumber"
                  type="number"
                  min={0}
                  value={jersey}
                  onChange={(e) => setJersey(e.target.value)}
                />
              </Field>
            </div>
            {showJerseyMap ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("jerseyMapHint")}
                </span>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: maxJersey }, (_, i) => i + 1).map((n) => {
                    const isTaken = takenSet.has(n);
                    const isSelected = Number(jersey) === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={isTaken && !isSelected}
                        onClick={() => setJersey(isSelected ? "" : String(n))}
                        title={
                          isTaken && !isSelected ? t("jerseyTakenLabel", { number: n }) : undefined
                        }
                        className={`size-7 rounded-md border text-xs tabular-nums transition-colors ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : isTaken
                              ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through"
                              : "border-input hover:bg-accent"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <Field>
              <FieldLabel>{t("playerPositionLabel")}</FieldLabel>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {PLAYER_POSITIONS.map((pos) => (
                  <Field key={pos} orientation="horizontal">
                    <Checkbox
                      id={`membership-position-${pos}`}
                      name="positions"
                      value={pos}
                      defaultChecked={membership?.positions?.includes(pos) ?? false}
                    />
                    <Label htmlFor={`membership-position-${pos}`} className="font-normal">
                      {t(`playerPositionOption.${pos}`)}
                    </Label>
                  </Field>
                ))}
              </div>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="membership-captain"
                name="isCaptain"
                defaultChecked={membership?.isCaptain ?? false}
              />
              <Label htmlFor="membership-captain" className="font-normal">
                {t("captainLabel")}
              </Label>
            </Field>
            <Field>
              <FieldLabel htmlFor="membership-position">
                {t("positionLabel")}
              </FieldLabel>
              <Input
                id="membership-position"
                name="position"
                defaultValue={membership?.position ?? ""}
                placeholder={t("positionPlaceholder")}
              />
            </Field>
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>
                {props.mode === "create-person"
                  ? t("addToTeamAction")
                  : isCreate
                    ? t("addMemberAction")
                    : t("saveChanges")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
