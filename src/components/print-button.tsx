"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <PrinterIcon data-icon="inline-start" />
      {label}
    </Button>
  );
}
