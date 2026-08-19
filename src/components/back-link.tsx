import { ArrowLeftIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BackLink({
  href,
  label,
  iconOnly = false,
  className,
}: {
  href: string;
  label: string;
  iconOnly?: boolean;
  className?: string;
}) {
  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={label}
        render={<Link href={href} />}
        nativeButton={false}
        className={cn("print:hidden", className)}
      >
        <ArrowLeftIcon />
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      render={<Link href={href} />}
      nativeButton={false}
      className={className}
    >
      <ArrowLeftIcon data-icon="inline-start" />
      {label}
    </Button>
  );
}
