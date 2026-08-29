"use client";

import { useTransition } from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getRemittanceXml } from "@/app/[locale]/(app)/cuotas/actions";
import { Button } from "@/components/ui/button";

function downloadXml(filename: string, xml: string): void {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DownloadRemittanceXmlButton({ remittanceId }: { remittanceId: string }) {
  const t = useTranslations("Cuotas");
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await getRemittanceXml(remittanceId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      downloadXml(result.filename, result.xml);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? (
        <Loader2Icon className="animate-spin" data-icon="inline-start" />
      ) : (
        <DownloadIcon data-icon="inline-start" />
      )}
      {t("downloadXmlAction")}
    </Button>
  );
}
