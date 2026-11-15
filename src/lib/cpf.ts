import { supabase } from "@/integrations/supabase/client";

export const cpfDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export function formatCpf(v: string | null | undefined): string {
  const d = cpfDigits(v);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (v ?? "");
}

// Paciente que já usa esse CPF (com ou sem pontuação). `excludeId` é o paciente que está sendo editado.
export async function findPatientByCpf(cpf: string | null | undefined, excludeId?: string | null) {
  const d = cpfDigits(cpf);
  if (!d) return null;
  const variants = Array.from(new Set([String(cpf).trim(), d, formatCpf(d)]));
  let q = supabase.from("patients").select("id,name,code").in("cpf", variants).limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return data?.[0] ?? null;
}

export const cpfDuplicateMessage = (p: { name: string; code: string }) =>
  `Já existe um paciente com este CPF: ${p.name} (${p.code}).`;

export const isCpfUniqueError = (e: { message?: string } | null | undefined) =>
  !!e?.message && e.message.includes("patients_company_cpf_key");
