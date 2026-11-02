// Código de barras da amostra, no mesmo formato do XLAB7: 10 dígitos "ASSNNNNNNN"
//   A        = número da amostra (1 a 9)
//   SS       = número do setor de realização (00 a 99; 00 se o setor não tiver código)
//   NNNNNNN  = número sequencial do pedido (1 a 9.999.999; depois volta ao 1)
// Ex.: amostra 1, setor Bioquímica = 13, pedido 98734  ->  1130098734

export const ORDER_SEQ_MAX = 9_999_999;

export type ParsedBarcode = { sample: number; sectorCode: number; orderSeq: number };

export const sampleDigit = (sampleNumber: number) => ((Math.max(1, Math.trunc(sampleNumber)) - 1) % 9) + 1;

export const orderSeq = (orderNumber: number) => ((Math.max(1, Math.trunc(orderNumber)) - 1) % ORDER_SEQ_MAX) + 1;

export function buildSampleBarcode(sampleNumber: number, sectorCode: number | null | undefined, orderNumber: number): string {
  const ss = Math.min(99, Math.max(0, Math.trunc(sectorCode ?? 0)));
  return `${sampleDigit(sampleNumber)}${String(ss).padStart(2, "0")}${String(orderSeq(orderNumber)).padStart(7, "0")}`;
}

/** Lê o que o leitor digitou. Retorna null se não for um código de amostra válido (10 dígitos). */
export function parseSampleBarcode(raw: string): ParsedBarcode | null {
  const s = raw.trim();
  if (!/^\d{10}$/.test(s)) return null;
  const sample = Number(s[0]);
  const seq = Number(s.slice(3));
  if (sample < 1 || seq < 1) return null;
  return { sample, sectorCode: Number(s.slice(1, 3)), orderSeq: seq };
}

/** Código (00 a 99) do setor; 0 quando o setor está vazio ou sem código cadastrado. */
export function sectorCodeFor(sector: string | null | undefined, codes: Map<string, number>): number {
  if (!sector) return 0;
  return codes.get(sector.trim().toLowerCase()) ?? 0;
}

export const sectorKey = (sector: string) => sector.trim().toLowerCase();

/** Quebra a lista de códigos de exame em linhas de até `perLine` caracteres e em etiquetas de até `maxLines` linhas. */
export function wrapExamCodes(codes: string[], perLine = 34, maxLines = 2): string[][] {
  const lines: string[] = [];
  let cur = "";
  for (const c of codes) {
    if (cur && (cur + " " + c).length > perLine) {
      lines.push(cur);
      cur = c;
    } else {
      cur = cur ? cur + " " + c : c;
    }
  }
  if (cur) lines.push(cur);
  const labels: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) labels.push(lines.slice(i, i + maxLines));
  return labels.length ? labels : [[]];
}

export type LabelData = {
  barcode: string;
  patientName: string;
  orderNumber: number;
  orderDate: string | null;
  birthDate: string | null;
  urgent: boolean;
  sector: string | null;
  material: string | null;
  sampleNumber: number;
  lines: string[];
  part: number; // etiqueta 1/2 (quando os exames não cabem em uma)
  parts: number;
};

type OrderForLabels = {
  order_number: number;
  order_date: string | null;
  is_urgent: boolean;
  patient: { name: string; birth_date: string | null } | null;
};
type SampleForLabels = { id: string; sample_number: number; sector: string | null; material: string | null; status: string };
type ItemForLabels = { sample_id: string | null; exam: { code: string } | null };

/** Monta as etiquetas de um pedido: uma (ou mais, se a lista de exames não couber) por amostra. */
export function buildLabels(
  order: OrderForLabels,
  samples: SampleForLabels[],
  items: ItemForLabels[],
  sectorCodes: Map<string, number>,
): LabelData[] {
  const out: LabelData[] = [];
  const sorted = samples.filter((s) => s.status !== "rejeitada").sort((a, b) => a.sample_number - b.sample_number);
  for (const s of sorted) {
    const codes = items.filter((i) => i.sample_id === s.id && i.exam?.code).map((i) => i.exam!.code);
    const groups = wrapExamCodes(codes);
    const barcode = buildSampleBarcode(s.sample_number, sectorCodeFor(s.sector, sectorCodes), order.order_number);
    groups.forEach((lines, idx) =>
      out.push({
        barcode,
        patientName: order.patient?.name ?? "",
        orderNumber: order.order_number,
        orderDate: order.order_date,
        birthDate: order.patient?.birth_date ?? null,
        urgent: order.is_urgent,
        sector: s.sector,
        material: s.material,
        sampleNumber: s.sample_number,
        lines,
        part: idx + 1,
        parts: groups.length,
      }),
    );
  }
  return out;
}
