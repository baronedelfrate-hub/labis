-- Valores de pânico e campos calculados.
--
-- * reference_ranges.panic_min / panic_max: limites de risco de vida (alerta abaixo/acima).
-- * exam_parameters.formula / decimals: campo calculado a partir de outros parâmetros do
--   mesmo exame, pelo código (ex.: TOTAL - DIRETA) e número de casas decimais do resultado.
-- * results / result_values.panic_min / panic_max: cópia dos limites usados no lançamento,
--   para o laudo e a liberação não mudarem se a referência for editada depois
--   (mesma ideia de reference_min / reference_max, que já são copiados).
--
-- Mudança aditiva: só colunas novas e opcionais; nada existente é alterado.

ALTER TABLE public.reference_ranges
  ADD COLUMN IF NOT EXISTS panic_min numeric,
  ADD COLUMN IF NOT EXISTS panic_max numeric;

ALTER TABLE public.exam_parameters
  ADD COLUMN IF NOT EXISTS formula text,
  ADD COLUMN IF NOT EXISTS decimals smallint;

ALTER TABLE public.exam_parameters
  DROP CONSTRAINT IF EXISTS exam_parameters_decimals_range;
ALTER TABLE public.exam_parameters
  ADD CONSTRAINT exam_parameters_decimals_range CHECK (decimals IS NULL OR (decimals >= 0 AND decimals <= 6));

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS panic_min numeric,
  ADD COLUMN IF NOT EXISTS panic_max numeric;

ALTER TABLE public.result_values
  ADD COLUMN IF NOT EXISTS panic_min numeric,
  ADD COLUMN IF NOT EXISTS panic_max numeric;
