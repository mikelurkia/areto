"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addMembership,
  updateMembership,
} from "@/app/[locale]/(app)/equipos/[teamId]/actions";
import { MembershipPersonCombobox } from "@/components/equipos/membership-person-combobox";
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
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

const MEMBERSHIP_ROLES = ["player", "coach", "staff"] as const;
const PLAYER_POSITIONS = ["cierre", "ala", "pivot", "portero"] as const;

type PersonOption = { id: string; firstName: string; lastName: string };
type TeamOption = { id: string; label: string };

/**
 * La capitanía no está aquí: es una característica del equipo y se designa en
 * su ficha (ver `TeamCaptainCard`), que garantiza un único capitán.
 */
type Membership = {
  id: string;
  personName: string;
  role: (typeof MEMBERSHIP_ROLES)[number];
  jerseyNumber: number | null;
  positions: string[];
  position: string | null;
};

type MembershipDialogProps =
  | { mode: "create"; teamId: string; availablePersons: PersonOption[] }
  | {
      mode: "create-person";
      personId: string;
      personName: string;
      availableTeams: TeamOption[];
    }
  | { mode: "edit"; membership: Membership };

export function MembershipDialog(props: MembershipDialogProps) {
  const t = useTranslations("Equipos");
  const isCreate = props.mode === "create" || props.mode === "create-person";
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? `membresia-nueva:${props.teamId}`
      : props.mode === "create-person"
        ? `membresia-persona:${props.personId}`
        : `membresia:${props.membership.id}`,
  );
  const [state, formAction] = useActionState(
    isCreate ? addMembership : updateMembership,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const membership = useFrozenWhileOpen(
    open,
    props.mode === "edit" ? props.membership : null,
  );

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
                <MembershipPersonCombobox
                  key={open ? "open" : "closed"}
                  id="membership-person"
                  persons={props.availablePersons}
                />
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
                  defaultValue={membership?.jerseyNumber ?? ""}
                />
              </Field>
            </div>
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
