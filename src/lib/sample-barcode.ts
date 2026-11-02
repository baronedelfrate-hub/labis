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
  tube: number; // tubo k ...
  tubes: number; // ... de n do mesmo material no pedido (símbolo "+" do XLAB7)
  labelIndex: number; // etiqueta j ...
  labelCount: number; // ... de L na mesma amostra (símbolo "^" do XLAB7)
  part: number; // continuação, quando os exames não cabem em uma etiqueta
  parts: number;
};

type OrderForLabels = {
  order_number: number;
  order_date: string | null;
  is_urgent: boolean;
  patient: { name: string; birth_date: string | null } | null;
};
type SampleForLabels = {
  id: string;
  sample_number: number;
  sector: string | null;
  material: string | null;
  status: string;
  material_seq?: number | null;
};
type ItemForLabels = {
  sample_ids: string[]; // todas as amostras do exame (um exame pode precisar de mais de uma)
  exam: { code: string; samples_count?: number | null; labels_per_sample?: number | null } | null;
};

const countOf = (v: number | null | undefined) => Math.max(1, Math.trunc(v ?? 1));

/** "+" antes do código: exame com mais de uma amostra. "^": exame com mais de uma etiqueta por amostra. */
export function examMark(exam: { samples_count?: number | null; labels_per_sample?: number | null }): string {
  return (countOf(exam.samples_count) > 1 ? "+" : "") + (countOf(exam.labels_per_sample) > 1 ? "^" : "");
}

/**
 * Monta as etiquetas de um pedido, como no manual do XLAB7:
 *  - cada amostra (tubo) tem o seu código de barras;
 *  - a amostra recebe tantas etiquetas quanto o exame que mais pedir (^); a etiqueta j lista só
 *    os exames que pedem pelo menos j etiquetas;
 *  - se a lista de exames não couber, imprime etiquetas de continuação com o mesmo código.
 */
export function buildLabels(
  order: OrderForLabels,
  samples: SampleForLabels[],
  items: ItemForLabels[],
  sectorCodes: Map<string, number>,
): LabelData[] {
  const out: LabelData[] = [];
  const active = samples.filter((s) => s.status !== "rejeitada");
  const sorted = [...active].sort((a, b) => a.sample_number - b.sample_number);
  for (const s of sorted) {
    const its = items.filter((i) => i.exam?.code && i.sample_ids.includes(s.id));
    const labelCount = Math.max(1, ...its.map((i) => countOf(i.exam!.labels_per_sample)));
    const tubes = Math.max(1, ...active.filter((x) => x.material === s.material).map((x) => countOf(x.material_seq)));
    const barcode = buildSampleBarcode(s.sample_number, sectorCodeFor(s.sector, sectorCodes), order.order_number);
    for (let j = 1; j <= labelCount; j++) {
      const codes = its
        .filter((i) => countOf(i.exam!.labels_per_sample) >= j)
        .map((i) => examMark(i.exam!) + i.exam!.code.trim());
      const groups = wrapExamCodes(codes);
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
          tube: countOf(s.material_seq),
          tubes,
          labelIndex: j,
          labelCount,
          part: idx + 1,
          parts: groups.length,
        }),
      );
    }
  }
  return out;
}

/** Texto da linha do setor da etiqueta, ex.: "* BIOQUIMICA · SORO · A1 · +1/2 ^1/2". */
export function sectorLine(l: LabelData): string {
  const bits = [`* ${l.sector ?? "SEM SETOR"}`, l.material ?? "", `A${l.sampleNumber}`];
  const marks: string[] = [];
  if (l.tubes > 1) marks.push(`+${l.tube}/${l.tubes}`);
  if (l.labelCount > 1) marks.push(`^${l.labelIndex}/${l.labelCount}`);
  if (marks.length) bits.push(marks.join(" "));
  if (l.parts > 1) bits.push(`cont. ${l.part}/${l.parts}`);
  return bits.filter(Boolean).join(" · ");
}

/**
 * Leitura do código na triagem. A amostra no código tem só 1 dígito (1 a 9), então pedidos com mais de 9
 * amostras repetem o dígito: devolve os números de amostra possíveis (A, A+9, A+18, ...).
 */
export function candidateSampleNumbers(digit: number, max = 36): number[] {
  const out: number[] = [];
  for (let n = digit; n <= max; n += 9) out.push(n);
  return out;
}
