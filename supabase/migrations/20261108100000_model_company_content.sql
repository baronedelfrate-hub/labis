-- Conteúdo padrão da empresa modelo (a que é copiada para cada laboratório novo).
--
-- 1) 40 exames de rotina que faltavam, importados do catálogo do XLAB7 (parâmetros, referências e dados do exame).
--    Referências em texto entram com needs_review = true (precisam de revisão do responsável técnico);
--    faixas numéricas entram sem pendência, igual à importação da tela de exames.
-- 2) Preço na tabela "Particular" para os exames da empresa modelo que ainda não tinham, vindo da tabela
--    PART do XLAB7. Tabelas de convênio (em CH) não são mexidas: dependem do valor do CH de cada laboratório.
-- 3) 10 grupos de exames (perfis e check-ups) com os exames do padrão.
--
-- Idempotente: só cria o que ainda não existe na empresa modelo. Não apaga nem altera exames existentes.

DO $$
DECLARE
  m uuid;
  codes text[] := ARRAY[
    'ALB','PT','PTF','LDL','VLDL','P','CL','CPK','TRANS','LIPA','PCR','FR','GLIP',
    'T3','T3L','FSH','LH','PRL','E2','PRG','TESTO','PSA','BETAQ','AAM',
    'VB12','AF',
    'PLA','RET','VHS','GS','TP','TTPA','FIB',
    'HIV','HBSAG','HCV','VD','TOXOG','TOXOM',
    'SO'
  ];
  qualitative text[] := ARRAY['HIV','HBSAG','HCV','VD','TOXOG','TOXOM','GS','SO'];
  l record; p record; r record; g record;
  new_exam uuid; pid uuid; sec text;
  n_exams int := 0;
BEGIN
  SELECT id INTO m FROM public.companies WHERE is_template LIMIT 1;
  IF m IS NULL THEN
    RAISE NOTICE 'Sem empresa modelo: nada a fazer.';
    RETURN;
  END IF;

  FOR l IN
    SELECT * FROM public.xlab_legacy_exams x
     WHERE x.code = ANY(codes)
       AND NOT EXISTS (SELECT 1 FROM public.exams e WHERE e.company_id = m AND upper(e.code) = upper(x.code))
     ORDER BY x.code
  LOOP
    sec := CASE coalesce(nullif(trim(l.price_sector), ''), nullif(trim(l.sector), ''))
             WHEN 'BIO' THEN 'BIOQ' WHEN 'FEZ' THEN 'FEZES'
             ELSE coalesce(nullif(trim(l.price_sector), ''), nullif(trim(l.sector), '')) END;

    INSERT INTO public.exams (company_id, code, name, sector, tech_sector, price_sector, material,
                              deadline_days, fasting_hours, is_urgent_allowed, is_text, samples_count, labels_per_sample)
    VALUES (m, l.code, l.name, sec, nullif(trim(l.sector), ''), nullif(trim(l.price_sector), ''), nullif(trim(l.material), ''),
            coalesce(l.days, 1), coalesce(l.fasting_hours, 0), true, coalesce(l.is_text, false), 1, 1)
    RETURNING id INTO new_exam;
    n_exams := n_exams + 1;

    FOR p IN
      SELECT * FROM public.xlab_legacy_reference_staging s
       WHERE s.exam_code = l.code AND s.source = 'param' ORDER BY s.param_order, s.param_code
    LOOP
      INSERT INTO public.exam_parameters (exam_id, code, name, unit, display_order, value_type)
      VALUES (new_exam, p.param_code, coalesce(nullif(p.label, ''), p.param_code, 'Parâmetro'), p.unit,
              coalesce(p.param_order, 0),
              CASE WHEN l.code = ANY(qualitative) THEN 'qualitative' ELSE 'numeric' END::public.exam_value_type)
      RETURNING id INTO pid;

      IF (p.range_min IS NOT NULL AND p.range_min <> 0) OR (p.range_max IS NOT NULL AND p.range_max <> 0) THEN
        INSERT INTO public.reference_ranges (company_id, exam_id, exam_parameter_id, range_min, range_max, display_text, needs_review)
        VALUES (m, NULL, pid, p.range_min, p.range_max, trim(coalesce(p.range_min::text, '') || ' - ' || coalesce(p.range_max::text, '')), false);
      END IF;
    END LOOP;

    FOR r IN
      SELECT * FROM public.xlab_legacy_reference_staging s
       WHERE s.exam_code = l.code AND s.source = 'reference' AND coalesce(trim(s.reference_text), '') <> ''
    LOOP
      pid := NULL;
      IF r.param_code IS NOT NULL THEN
        SELECT id INTO pid FROM public.exam_parameters WHERE exam_id = new_exam AND code = r.param_code LIMIT 1;
      END IF;
      INSERT INTO public.reference_ranges (company_id, exam_id, exam_parameter_id, sex, effective_from, display_text, needs_review)
      VALUES (m, CASE WHEN pid IS NULL THEN new_exam END, pid,
              CASE WHEN r.sex IN ('M', 'F') THEN r.sex::public.sex_type END,
              r.effective_from, r.reference_text, true);
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Exames novos na empresa modelo: %', n_exams;

  -- 2) Preço particular dos exames da empresa modelo que ainda não têm
  INSERT INTO public.price_table_items (company_id, price_table_id, exam_id, price)
  SELECT m, pt.id, e.id, lp.price
    FROM public.price_tables pt
    JOIN public.exams e ON e.company_id = m
    JOIN public.xlab_legacy_prices lp ON upper(lp.exam_code) = upper(e.code) AND lp.table_code = 'PART'
   WHERE pt.company_id = m AND pt.name = 'Particular'
     AND lp.price IS NOT NULL AND lp.price > 0
     AND NOT EXISTS (SELECT 1 FROM public.price_table_items i WHERE i.price_table_id = pt.id AND i.exam_id = e.id);

  -- 3) Grupos de exames (perfis e check-ups)
  FOR g IN
    SELECT * FROM (VALUES
      ('Perfil lipídico',          ARRAY['COLE','HDL','LDL','VLDL','TRI']),
      ('Perfil hepático',          ARRAY['TGO','TGP','GAMA','FAL','BILI','ALB','PT']),
      ('Perfil renal',             ARRAY['UR','CRE','AUR','NA','K','CA']),
      ('Perfil tireoidiano',       ARRAY['TSH','T4L','T3','AAM']),
      ('Perfil diabético',         ARRAY['GLI','GLIP','HBGLI','IN']),
      ('Perfil de anemia',         ARRAY['HG','FE','FER','TRANS','VB12','AF']),
      ('Coagulação',               ARRAY['TP','TTPA','FIB','PLA']),
      ('Pré-natal (1º trimestre)', ARRAY['HG','GS','GLI','UI','HIV','VD','HBSAG','HCV','TOXOG','TOXOM','PPF','URO']),
      ('Pré-operatório',           ARRAY['HG','GLI','UR','CRE','NA','K','TP','TTPA','UI']),
      ('Check-up geral',           ARRAY['HG','GLI','COLE','HDL','LDL','TRI','UR','CRE','AUR','TGO','TGP','TSH','UI','PPF'])
    ) AS v(name, exam_codes)
  LOOP
    INSERT INTO public.exam_groups (company_id, name) VALUES (m, g.name) ON CONFLICT (company_id, name) DO NOTHING;
    INSERT INTO public.exam_group_items (company_id, exam_group_id, exam_id)
    SELECT m, (SELECT id FROM public.exam_groups WHERE company_id = m AND name = g.name), e.id
      FROM public.exams e WHERE e.company_id = m AND e.code = ANY(g.exam_codes)
    ON CONFLICT (exam_group_id, exam_id) DO NOTHING;
  END LOOP;
END
$$;
