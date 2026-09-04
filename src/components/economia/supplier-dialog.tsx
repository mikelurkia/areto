"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createSupplier,
  deleteSupplier,
  updateSupplier,
} from "@/app/[locale]/(app)/economia/proveedores/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";

export type SupplierRow = {
  id: string;
  name: string;
  taxId: string | null;
  iban: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  defaultCategoryId: string | null;
  notes: string | null;
};

export type NamedOption = { id: string; name: string };

type SupplierDialogProps = {
  categories: NamedOption[];
} & ({ mode: "create" } | { mode: "edit"; supplier: SupplierRow });

export function SupplierDialog(props: SupplierDialogProps) {
  const t = useTranslations("Economia");
  const supplier = props.mode === "edit" ? props.supplier : null;
  const [open, setOpen] = useDialogParam(
    supplier ? `proveedor:${supplier.id}` : "proveedor-nuevo",
  );
  const [state, action] = useActionState(supplier ? updateSupplier : createSupplier, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const categoryName = (id: string) => props.categories.find((c) => c.id === id)?.name ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {supplier ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">{t("editSupplierSr", { name: supplier.name })}</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createSupplier")}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? t("editSupplierTitle") : t("newSupplierTitle")}</DialogTitle>
        </DialogHeader>
        <form action={action}>
          {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="supplier-name">{t("supplierNameLabel")}</FieldLabel>
                <Input
                  id="supplier-name"
                  name="name"
                  defaultValue={supplier?.name ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="supplier-tax-id">{t("supplierTaxIdLabel")}</FieldLabel>
                <Input id="supplier-tax-id" name="taxId" defaultValue={supplier?.taxId ?? ""} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="supplier-iban">{t("accountIbanLabel")}</FieldLabel>
              <Input
                id="supplier-iban"
                name="iban"
                defaultValue={supplier?.iban ?? ""}
                placeholder={t("accountIbanPlaceholder")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="supplier-contact-name">
                  {t("supplierContactNameLabel")}
                </FieldLabel>
                <Input
                  id="supplier-contact-name"
                  name="contactName"
                  defaultValue={supplier?.contactName ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="supplier-contact-phone">
                  {t("supplierContactPhoneLabel")}
                </FieldLabel>
                <Input
                  id="supplier-contact-phone"
                  name="contactPhone"
                  defaultValue={supplier?.contactPhone ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="supplier-contact-email">
                {t("supplierContactEmailLabel")}
              </FieldLabel>
              <Input
                id="supplier-contact-email"
                name="contactEmail"
                type="email"
                defaultValue={supplier?.contactEmail ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="supplier-default-category">
                {t("supplierDefaultCategoryLabel")}
              </FieldLabel>
              <Select name="defaultCategoryId" defaultValue={supplier?.defaultCategoryId ?? "none"}>
                <SelectTrigger id="supplier-default-category" className="w-full">
                  <SelectValue>
                    {(value: string) => categoryName(value) || t("categoryNone")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("categoryNone")}</SelectItem>
                  {props.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="supplier-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="supplier-notes"
                name="notes"
                rows={2}
                defaultValue={supplier?.notes ?? ""}
              />
            </Field>
            <FormError message={state.error} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>{supplier ? t("saveChanges") : t("createSupplier")}</SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSupplierDialog({ id, name }: { id: string; name: string }) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Economia"
      entityKey="Supplier"
      paramKey="borrar-proveedor"
      values={{ name }}
      deleteAction={deleteSupplier}
    />
  );
}
