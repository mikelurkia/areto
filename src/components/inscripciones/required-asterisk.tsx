/** Asterisco de "campo obligatorio", oculto a lectores de pantalla porque el
 * propio atributo `required` del input ya lo anuncia — es solo la marca visual. */
export function Req() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" *"}
    </span>
  );
}
