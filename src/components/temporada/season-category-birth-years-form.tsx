"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { updateSeasonCategoryBirthYears } from "@/app/[locale]/(app)/temporadas/actions";
import { TEAM_CATEGORIES } from "@/components/equipos/team-categories";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionToast } from "@/hooks/use-action-toast";

type CategoryBirthYears = {
  category: string;
  minBirthYear: number | null;
  maxBirthYear: number | null;
};

/**
 * El rango de año de nacimiento se define una vez por categoría y temporada,
 * no por equipo: dos equipos de la misma categoría compartían antes el mismo
 * dato dos veces. Las 5 categorías son fijas (`TEAM_CATEGORIES`), así que la
 * tabla siempre tiene 5 filas, editables de una sentada con un único botón.
 */
export function SeasonCategoryBirthYearsForm({
  seasonId,
  rows,
  editable,
}: {
  seasonId: string;
  rows: CategoryBirthYears[];
  editable: boolean;
}) {
  const t = useTranslations("Temporadas");
  const tEquipos = useTranslations("Equipos");
  const [state, formAction] = useActionState(updateSeasonCategoryBirthYears, {});
  useActionToast(state);

  const byCategory = new Map(rows.map((row) => [row.category, row]));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="seasonId" value={seasonId} />
      <Card size="sm">
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tEquipos("colCategory")}</TableHead>
                <TableHead>{t("minBirthYearLabel")}</TableHead>
                <TableHead>{t("maxBirthYearLabel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TEAM_CATEGORIES.map((category) => {
                const row = byCategory.get(category);
                return (
                  <TableRow key={category}>
                    <TableCell className="font-medium">
                      {tEquipos(`category.${category}`)}
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <Input
                          name={`minBirthYear-${category}`}
                          type="number"
                          inputMode="numeric"
                          placeholder="2010"
                          defaultValue={row?.minBirthYear ?? ""}
                          className="w-28"
                          aria-label={`${tEquipos(`category.${category}`)} · ${t("minBirthYearLabel")}`}
                        />
                      ) : (
                        (row?.minBirthYear ?? "—")
                      )}
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <Input
                          name={`maxBirthYear-${category}`}
                          type="number"
                          inputMode="numeric"
                          placeholder="2011"
                          defaultValue={row?.maxBirthYear ?? ""}
                          className="w-28"
                          aria-label={`${tEquipos(`category.${category}`)} · ${t("maxBirthYearLabel")}`}
                        />
                      ) : (
                        (row?.maxBirthYear ?? "—")
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <FormError message={state.error} />
      {editable ? (
        <div className="flex justify-end">
          <SubmitButton>{t("saveCategoryBirthYearsAction")}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
