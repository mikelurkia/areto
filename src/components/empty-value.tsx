/**
 * El hueco de un dato que no hay.
 *
 * La raya estaba escrita a mano en tres sitios del listado de personas y como
 * constante local en la hoja de contactos y en el listado médico. Es el mismo
 * signo con el mismo significado, así que vive una vez.
 */

/** Para tablas de texto plano (papel, CSV) donde no cabe un componente. */
export const EMPTY = "—";

export function EmptyValue() {
  return <span className="text-muted-foreground">{EMPTY}</span>;
}
