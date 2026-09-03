"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createCategory,
  updateCategory,
} from "@/app/[locale]/(app)/economia/cuentas/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import { useDialogParam } from "@/hooks/use-dialog-param";

export type CategoryRow = {
  id: string;
  kind: "income" | "expense";
  name: string;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Alta y edición de una categoría económica. No hay borrado a propósito: una
 * categoría se retira desmarcando "activa", porque borrarla rompería el
 * histórico de lo ya clasificado con ella.
 */
export function CategoryDialog(
  props: { mode: "create" } | { mode: "edit"; category: CategoryRow },
) {
  const t = useTranslations("Economia");
  const category = props.mode === "edit" ? props.category : null;
  const [open, setOpen] = useDialogParam(
    category ? `categoria:${category.id}` : "categoria-nueva",
  );
  const [state, action] = useActionState(category ? updateCategory : createCategory, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {category ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">{t("editCategorySr", { name: category.name })}</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <PlusIcon data-icon="inline-start" />
          {t("createCategory")}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? t("editCategoryTitle") : t("newCategoryTitle")}</DialogTitle>
          {category ? null : (
            <DialogDescription>{t("newCategoryDescription")}</DialogDescription>
          )}
        </DialogHeader>
        <form action={action}>
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="category-name">{t("categoryNameLabel")}</FieldLabel>
              <Input
                id="category-name"
                name="name"
                defaultValue={category?.name ?? ""}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="category-kind">{t("categoryKindLabel")}</FieldLabel>
                <Select name="kind" defaultValue={category?.kind ?? "expense"}>
                  <SelectTrigger id="category-kind" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        t(`categoryKind_${value === "income" ? "income" : "expense"}`)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">{t("categoryKind_income")}</SelectItem>
                    <SelectItem value="expense">{t("categoryKind_expense")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="category-sort-order">{t("sortOrderLabel")}</FieldLabel>
                <Input
                  id="category-sort-order"
                  name="sortOrder"
                  type="number"
                  step="10"
                  defaultValue={category?.sortOrder ?? 0}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="category-active"
                name="isActive"
                defaultChecked={category ? category.isActive : true}
              />
              <Label htmlFor="category-active" className="font-normal">
                {t("categoryActiveLabel")}
              </Label>
            </Field>
            <FormError message={state.error} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>{category ? t("saveChanges") : t("createCategory")}</SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
