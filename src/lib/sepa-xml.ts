import { isValidIban } from "@/lib/iban";

export type SepaCreditor = {
  legalName: string;
  iban: string;
  sepaCreditorId: string;
};

export type SepaChargeForXml = {
  amountCents: number;
  endToEndId: string;
  mandateId: string; // RUM
  mandateSignedOn: string; // ISO date
  sequenceType: "FRST" | "RCUR";
  debtorName: string;
  debtorIban: string;
  concept: string; // RmtInf/Ustrd
};

export type BuildPain008Params = {
  messageId: string;
  creationDateTime: Date;
  collectionDate: string; // ISO date
  creditor: SepaCreditor;
  charges: SepaChargeForXml[];
};

/** Escapa entidades XML en texto libre (nombres, conceptos). */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function assertMaxLength(value: string, max: number, label: string): void {
  if (value.length > max) {
    throw new Error(`${label} supera los ${max} caracteres: "${value}"`);
  }
}

function buildPmtInf(params: {
  pmtInfId: string;
  sequenceType: "FRST" | "RCUR";
  collectionDate: string;
  creditor: SepaCreditor;
  charges: SepaChargeForXml[];
}): string {
  const { pmtInfId, sequenceType, collectionDate, creditor, charges } = params;
  const ctrlSum = centsToAmount(charges.reduce((sum, c) => sum + c.amountCents, 0));

  const txs = charges
    .map((charge) => {
      if (!isValidIban(charge.debtorIban)) {
        throw new Error(`IBAN de deudor no válido: "${charge.debtorIban}"`);
      }
      assertMaxLength(charge.endToEndId, 35, "EndToEndId");
      assertMaxLength(charge.mandateId, 35, "MndtId");
      const debtorIban = charge.debtorIban.replace(/\s+/g, "").toUpperCase();
      return `        <DrctDbtTxInf>
          <PmtId>
            <EndToEndId>${xmlEscape(charge.endToEndId)}</EndToEndId>
          </PmtId>
          <InstdAmt Ccy="EUR">${centsToAmount(charge.amountCents)}</InstdAmt>
          <DrctDbtTx>
            <MndtRltdInf>
              <MndtId>${xmlEscape(charge.mandateId)}</MndtId>
              <DtOfSgntr>${charge.mandateSignedOn}</DtOfSgntr>
            </MndtRltdInf>
          </DrctDbtTx>
          <DbtrAgt>
            <FinInstnId>
              <Othr>
                <Id>NOTPROVIDED</Id>
              </Othr>
            </FinInstnId>
          </DbtrAgt>
          <Dbtr>
            <Nm>${xmlEscape(charge.debtorName)}</Nm>
          </Dbtr>
          <DbtrAcct>
            <Id>
              <IBAN>${debtorIban}</IBAN>
            </Id>
          </DbtrAcct>
          <RmtInf>
            <Ustrd>${xmlEscape(charge.concept)}</Ustrd>
          </RmtInf>
        </DrctDbtTxInf>`;
    })
    .join("\n");

  const creditorIban = creditor.iban.replace(/\s+/g, "").toUpperCase();

  return `    <PmtInf>
      <PmtInfId>${xmlEscape(pmtInfId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${charges.length}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>${sequenceType}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${collectionDate}</ReqdColltnDt>
      <Cdtr>
        <Nm>${xmlEscape(creditor.legalName)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${creditorIban}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <Othr>
            <Id>NOTPROVIDED</Id>
          </Othr>
        </FinInstnId>
      </CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${xmlEscape(creditor.sepaCreditorId)}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
${txs}
    </PmtInf>`;
}

/**
 * Construye el XML pain.008.001.02 de una remesa. Función pura: no toca la
 * base de datos, solo formatea. Un `PmtInf` por `SeqTp` (FRST/RCUR no pueden
 * mezclarse en el mismo bloque), cada uno con su propio `NbOfTxs`/`CtrlSum`.
 */
export function buildPain008(params: BuildPain008Params): string {
  const { messageId, creationDateTime, collectionDate, creditor, charges } = params;
  if (!isValidIban(creditor.iban)) {
    throw new Error(`IBAN de acreedor no válido: "${creditor.iban}"`);
  }
  assertMaxLength(messageId, 35, "MsgId");
  if (charges.length === 0) throw new Error("No hay cargos para generar el XML");

  const firstCharges = charges.filter((c) => c.sequenceType === "FRST");
  const recurCharges = charges.filter((c) => c.sequenceType === "RCUR");

  const pmtInfBlocks = [
    firstCharges.length > 0
      ? buildPmtInf({
          pmtInfId: `${messageId}-FRST`,
          sequenceType: "FRST",
          collectionDate,
          creditor,
          charges: firstCharges,
        })
      : null,
    recurCharges.length > 0
      ? buildPmtInf({
          pmtInfId: `${messageId}-RCUR`,
          sequenceType: "RCUR",
          collectionDate,
          creditor,
          charges: recurCharges,
        })
      : null,
  ].filter((block): block is string => block !== null);

  const ctrlSum = centsToAmount(charges.reduce((sum, c) => sum + c.amountCents, 0));

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${xmlEscape(messageId)}</MsgId>
      <CreDtTm>${creationDateTime.toISOString()}</CreDtTm>
      <NbOfTxs>${charges.length}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${xmlEscape(creditor.legalName)}</Nm>
      </InitgPty>
    </GrpHdr>
${pmtInfBlocks.join("\n")}
  </CstmrDrctDbtInitn>
</Document>
`;
}
