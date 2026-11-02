// Helpers para exames com múltiplos parâmetros e referências por idade/sexo.

export type ExamParameter = {
  id: string;
  exam_id: string;
  code: string | null;
  name: string;
  unit: string | null;
  display_order: number;
  value_type: "numeric" | "qualitative" | "text";
  group_label: string | null;
};

export type ReferenceRange = {
  id: string;
  exam_id: string | null;
  exam_parameter_id: string | null;
  sex: "M" | "F" | null;
  age_min_months: number | null;
  age_max_months: number | null;
  range_min: number | null;
  range_max: number | null;
  panic_min?: number | null;
  panic_max?: number | null;
  category_label: string | null;
  display_text: string;
};

export function computeAgeMonths(birthDate: string | null | undefined, at: Date = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  let months = (at.getFullYear() - b.getFullYear()) * 12 + (at.getMonth() - b.getMonth());
  if (at.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}

export function formatAgeMonths(months: number | null | undefined): string {
  if (months == null) return "—";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}m`;
  if (rem === 0) return `${years}a`;
  return `${years}a ${rem}m`;
}

export function findMatchingRange(
  ranges: ReferenceRange[],
  opts: { sex?: "M" | "F" | null; ageMonths?: number | null },
): ReferenceRange | null {
  const { sex, ageMonths } = opts;
  const eligible = ranges.filter((r) => {
    if (r.sex && sex && r.sex !== sex) return false;
    if (r.sex && !sex) return false;
    if (ageMonths != null) {
      if (r.age_min_months != null && ageMonths < r.age_min_months) return false;
      if (r.age_max_months != null && ageMonths > r.age_max_months) return false;
    } else {
      if (r.age_min_months != null || r.age_max_months != null) return false;
    }
    return true;
  });
  // Preferência: sexo específico > sem sexo; faixa com limites definidos > aberta.
  eligible.sort((a, b) => {
    const sa = (a.sex ? 2 : 0) + (a.age_min_months != null || a.age_max_months != null ? 1 : 0);
    const sb = (b.sex ? 2 : 0) + (b.age_min_months != null || b.age_max_months != null ? 1 : 0);
    return sb - sa;
  });
  return eligible[0] ?? null;
}
