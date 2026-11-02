-- Campo "conta como resultado" (LeTipo do XLAB7) e linhas extras do laudo.
--
-- * exam_parameters.counts_as_result: se false, o campo preenchido sozinho NÃO faz o exame
--   ser considerado com resultado (útil para campos de observação antes do resultado).
-- * exam_parameters.extra_line_before / extra_line_after: texto impresso no laudo antes/depois do campo.
-- * result_values.extra_before / extra_after: cópia do texto no lançamento, para o laudo já
--   liberado não mudar se o cadastro for editado depois (mesma ideia das referências).
--
-- Mudança aditiva: o padrão (true / nulo) mantém o comportamento atual.

ALTER TABLE public.exam_parameters
  ADD COLUMN IF NOT EXISTS counts_as_result boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS extra_line_before text,
  ADD COLUMN IF NOT EXISTS extra_line_after text;

ALTER TABLE public.result_values
  ADD COLUMN IF NOT EXISTS extra_before text,
  ADD COLUMN IF NOT EXISTS extra_after text;
