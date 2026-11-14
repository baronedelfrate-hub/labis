-- Hemograma (HG) da empresa modelo: faixas de referência alinhadas ao laudo do XLAB (Laboratório Evangélico).
-- Só altera o texto de referência já existente (sem apagar nem criar linhas), por ordem de exibição do parâmetro.
-- Faixas masculinas (eritrócitos, hemoglobina, hematócrito) permanecem como estavam; as femininas seguem o laudo do XLAB.
-- Leucócitos e plaquetas ficam na unidade do cadastro (mil/mm3), que é como o resultado é digitado.
-- Empresas já criadas não são alteradas (só as novas herdam do modelo).
DO $$
DECLARE m uuid; hg uuid;
BEGIN
  SELECT id INTO m FROM public.companies WHERE is_template LIMIT 1;
  IF m IS NULL THEN RETURN; END IF;
  SELECT id INTO hg FROM public.exams WHERE company_id = m AND upper(code) = 'HG' LIMIT 1;
  IF hg IS NULL THEN RETURN; END IF;

  UPDATE public.reference_ranges r
     SET display_text = v.txt, needs_review = false
    FROM public.exam_parameters p
    JOIN (VALUES
      (1,  'F',  '3.9 até 5.0 milhões/mm3'),
      (2,  'F',  '12,0 até 15,5 g/dL'),
      (4,  'F',  '35 até 45 %'),
      (5,  NULL, '81 até 92 um3'),
      (6,  NULL, '26 até 34 pg'),
      (7,  NULL, '31 até 36 %'),
      (8,  NULL, '4,0 até 10,0 mil/mm3'),
      (11, NULL, '1 até 6 %'),
      (12, NULL, '45 até 75 %'),
      (13, NULL, '1 até 6 %'),
      (17, NULL, '1 até 8 %'),
      (20, NULL, '40 até 600'),
      (21, NULL, '1600 até 7500'),
      (22, NULL, '40 até 600'),
      (24, NULL, '1000 até 3500'),
      (26, NULL, '40 até 800'),
      (28, NULL, '150 a 450 mil/mm3')
    ) AS v(ord, sx, txt) ON v.ord = p.display_order
   WHERE p.exam_id = hg
     AND r.exam_parameter_id = p.id
     AND r.company_id = m
     AND r.age_min_months IS NULL AND r.age_max_months IS NULL
     AND ((v.sx IS NULL AND r.sex IS NULL) OR (v.sx IS NOT NULL AND r.sex::text = v.sx));
END $$;
