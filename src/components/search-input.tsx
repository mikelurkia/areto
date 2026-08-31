"use client";

import { forwardRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/**
 * El buscador de un listado.
 *
 * Los ocho browsers de la aplicación lo tenían copiado a mano con la misma
 * receta: un `div.relative`, un `SearchIcon` posicionado en absoluto y un
 * `Input` con `pl-8` para dejarle hueco. `InputGroup` ya resuelve eso —y con la
 * misma altura, `h-8`— sin tener que acertar el desplazamiento a ojo.
 *
 * El botón de borrado solo aparece con texto escrito: en un campo vacío no
 * significa nada y roba sitio al `placeholder`.
 */
export const SearchInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    /** Rótulo del botón de borrado, para lectores de pantalla. */
    clearLabel: string;
    className?: string;
  }
>(function SearchInput(
  { value, onValueChange, placeholder, clearLabel, className },
  ref,
) {
  return (
    <InputGroup className={cn("w-full sm:w-56", className)}>
      <InputGroupAddon>
        <SearchIcon className="text-muted-foreground" />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => onValueChange("")}
            aria-label={clearLabel}
            title={clearLabel}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
});
