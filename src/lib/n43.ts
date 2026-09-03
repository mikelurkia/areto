import type { ParsedImport, ParsedMovement } from "@/lib/movement-import";

/**
 * Parser de Cuaderno 43 AEB (Norma 43): líneas de ancho fijo, sin separador,
 * identificadas por los 2 primeros caracteres (registro 11 cabecera de
 * cuenta, 22 movimiento, 23 concepto complementario, 33 cierre de cuenta, 88
 * fin de fichero). Fechas AAMMDD. El saldo de cada apunte no viene en su
 * registro —el 22 no lo trae—, se arrastra desde el saldo inicial del 11.
 *
 * V1 solo admite un registro 11 por fichero: `financial_accounts` guarda el
 * IBAN completo, no banco/sucursal/cuenta por separado, así que no hay forma
 * fiable de repartir un fichero multi-cuenta entre varias `financial_account`
 * sin pedírselo al usuario aparte. Se rechaza con un error claro.
 */

function decodeN43Date(raw: string): string {
  const yy = raw.slice(0, 2);
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6);
  return `20${yy}-${mm}-${dd}`;
}

export class N43ParseError extends Error {}

export function parseN43(content: string): ParsedImport {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.length > 0);

  let sawAccount = false;
  let runningBalanceCents = 0;
  const movements: ParsedMovement[] = [];

  for (const line of lines) {
    const recordType = line.slice(0, 2);
    switch (recordType) {
      case "11": {
        if (sawAccount) {
          throw new N43ParseError("n43MultipleAccounts");
        }
        sawAccount = true;
        const sign = line.slice(32, 33) === "2" ? 1 : -1;
        runningBalanceCents = sign * Number(line.slice(33, 47));
        break;
      }
      case "22": {
        const amountSign = line.slice(27, 28) === "2" ? 1 : -1;
        const amountCents = amountSign * Number(line.slice(28, 42));
        runningBalanceCents += amountCents;
        movements.push({
          bookedOn: decodeN43Date(line.slice(10, 16)),
          valueOn: decodeN43Date(line.slice(16, 22)),
          amountCents,
          concept: line.slice(52).trim(),
          counterparty: null,
          balanceCents: runningBalanceCents,
        });
        break;
      }
      case "23": {
        const extra = line.slice(4).trim();
        const last = movements[movements.length - 1];
        if (last && extra) {
          last.concept = `${last.concept} ${extra}`.trim();
        }
        break;
      }
      case "33":
      case "88":
        break;
      default:
        throw new N43ParseError("n43UnknownRecord");
    }
  }

  if (!sawAccount) throw new N43ParseError("n43NoAccount");
  if (movements.length === 0) throw new N43ParseError("n43NoMovements");
  if (movements.some((m) => Number.isNaN(m.amountCents))) {
    throw new N43ParseError("n43Malformed");
  }

  const dates = movements.map((m) => m.bookedOn).sort();
  return { movements, fromDate: dates[0], toDate: dates[dates.length - 1] };
}
