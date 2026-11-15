-- CPF único por laboratório (ignorando pontos e traço; CPF vazio não conta).
-- Se já houver CPF repetido, o índice NÃO é criado (o aviso mostra quais); corrija os cadastros e rode de novo.
-- A tela já avisa antes de salvar um CPF que existe; o índice garante também no banco.
DO $$
DECLARE dups text;
BEGIN
  SELECT string_agg(d.cpf_digits || ' (' || d.qtd || ' cadastros)', '; ') INTO dups
  FROM (
    SELECT regexp_replace(cpf, '\D', '', 'g') AS cpf_digits, count(*) AS qtd
      FROM public.patients
     WHERE nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '') IS NOT NULL
     GROUP BY company_id, regexp_replace(cpf, '\D', '', 'g')
    HAVING count(*) > 1
  ) d;

  IF dups IS NOT NULL THEN
    RAISE NOTICE 'Índice de CPF único NÃO criado. CPFs repetidos: %', dups;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS patients_company_cpf_key
      ON public.patients (company_id, (regexp_replace(cpf, '\D', '', 'g')))
      WHERE nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '') IS NOT NULL;
  END IF;
END $$;
