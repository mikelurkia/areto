"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Prioridad de una columna en pantallas estrechas. La tabla no se transforma
 * en tarjetas: simplemente esconde las columnas de apoyo, que vuelven al
 * ensanchar la ventana y —por la regla de `@media print` de `globals.css`—
 * siempre al imprimir, sea cual sea el tamaño del papel.
 */
type TablePriority = "primary" | "secondary" | "tertiary"

const priorityClasses: Record<TablePriority, string> = {
  primary: "",
  secondary: "hidden md:table-cell",
  tertiary: "hidden lg:table-cell",
}

/**
 * `nowrap` es opt-in: solo para valores atómicos que se leen mal partidos
 * (fechas, importes, documentos de identidad). Por defecto el texto rompe
 * línea, que es lo que permite que una tabla quepa en un móvil.
 */
type TableCellLayoutProps = {
  priority?: TablePriority
  nowrap?: boolean
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  priority,
  nowrap,
  ...props
}: React.ComponentProps<"th"> & TableCellLayoutProps) {
  return (
    <th
      data-slot="table-head"
      data-priority={priority}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-foreground [&:has([role=checkbox])]:pr-0",
        nowrap && "whitespace-nowrap",
        priority && priorityClasses[priority],
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  priority,
  nowrap,
  ...props
}: React.ComponentProps<"td"> & TableCellLayoutProps) {
  return (
    <td
      data-slot="table-cell"
      data-priority={priority}
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0",
        nowrap && "whitespace-nowrap",
        priority && priorityClasses[priority],
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

export type { TablePriority }
