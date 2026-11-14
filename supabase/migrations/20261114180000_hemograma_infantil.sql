-- Hemograma infantil (exame HGI) na empresa modelo, com faixas de referência por idade.
-- Fonte: tabela enviada pelo testador (Wintrobe, Hematologia Clínica, 9ª ed.; Manual de exames do Fleury).
-- Cria o exame copiando o hemograma padrão (HG): dados do exame, parâmetros e preços. As faixas de adulto NÃO são copiadas.
-- Faixas por idade em meses completos. Recém-nascido (0 mês) usa a faixa que cobre do nascimento aos 30 dias.
-- Sem faixa na tabela (ficam sem referência): relativos (%), basófilos, mielócitos, atípicos, bastonetes e segmentados
-- abaixo de 13 anos, plaquetas de 2 a 13 anos. Faixas marcadas como "a revisar" até o responsável técnico conferir.
-- Idempotente: não faz nada se o exame HGI já existir.
DO $$
DECLARE m uuid; hg uuid; novo uuid;
BEGIN
  SELECT id INTO m FROM public.companies WHERE is_template LIMIT 1;
  IF m IS NULL THEN RETURN; END IF;
  SELECT id INTO hg FROM public.exams WHERE company_id = m AND upper(code) = 'HG' LIMIT 1;
  IF hg IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.exams WHERE company_id = m AND upper(code) = 'HGI') THEN RETURN; END IF;
  -- só segue se o hemograma já estiver na ordem nova (Plaquetas = 8º parâmetro)
  IF NOT EXISTS (SELECT 1 FROM public.exam_parameters WHERE exam_id = hg AND display_order = 8 AND lower(name) LIKE 'plaquetas%') THEN
    RAISE EXCEPTION 'Hemograma HG fora da ordem esperada (Plaquetas deveria ser o 8º parâmetro).';
  END IF;

  INSERT INTO public.exams (company_id, code, name, sector, tech_sector, price_sector, support_lab_id, material,
                            deadline_days, fasting_hours, is_urgent_allowed, is_text, samples_count, labels_per_sample,
                            preparation_instructions, default_method, standard_notes, tiss_codigo_procedimento)
  SELECT company_id, 'HGI', 'HEMOGRAMA INFANTIL', sector, tech_sector, price_sector, support_lab_id, material,
         deadline_days, fasting_hours, is_urgent_allowed, is_text, samples_count, labels_per_sample,
         preparation_instructions, default_method, standard_notes, tiss_codigo_procedimento
    FROM public.exams WHERE id = hg
  RETURNING id INTO novo;

  INSERT INTO public.exam_parameters (exam_id, code, name, unit, display_order, value_type, group_label, decimals, formula, counts_as_result, extra_line_after, extra_line_before)
  SELECT novo, code, name, unit, display_order, value_type, group_label, decimals, formula, counts_as_result, extra_line_after, extra_line_before
    FROM public.exam_parameters WHERE exam_id = hg;

  INSERT INTO public.price_table_items (company_id, price_table_id, exam_id, price)
  SELECT company_id, price_table_id, novo, price FROM public.price_table_items WHERE exam_id = hg;

  INSERT INTO public.reference_ranges (company_id, exam_parameter_id, sex, age_min_months, age_max_months, range_min, range_max, display_text, needs_review)
  SELECT m, p.id, v.sx::public.sex_type, v.amin, v.amax, v.lo, v.hi, v.txt, true
    FROM (VALUES
      (1, NULL, 0, 0, 3.6, 6.6, '3,6 a 6,6 milhões/mm3'),
      (1, NULL, 1, 1, 3.0, 5.4, '3 a 5,4 milhões/mm3'),
      (1, NULL, 2, 2, 2.7, 4.9, '2,7 a 4,9 milhões/mm3'),
      (1, NULL, 3, 5, 3.1, 4.5, '3,1 a 4,5 milhões/mm3'),
      (1, NULL, 6, 23, 3.7, 5.3, '3,7 a 5,3 milhões/mm3'),
      (1, NULL, 24, 71, 3.9, 5.3, '3,9 a 5,3 milhões/mm3'),
      (1, NULL, 72, 143, 4.0, 5.2, '4 a 5,2 milhões/mm3'),
      (1, 'F', 144, 215, 4.1, 5.1, '4,1 a 5,1 milhões/mm3'),
      (1, 'M', 144, 215, 4.5, 5.3, '4,5 a 5,3 milhões/mm3'),
      (2, NULL, 0, 0, 12.5, 22.5, '12,5 a 22,5 g/dL'),
      (2, NULL, 1, 1, 10.0, 18.0, '10 a 18 g/dL'),
      (2, NULL, 2, 2, 9.0, 14.0, '9 a 14 g/dL'),
      (2, NULL, 3, 5, 9.5, 13.5, '9,5 a 13,5 g/dL'),
      (2, NULL, 6, 23, 10.5, 13.5, '10,5 a 13,5 g/dL'),
      (2, NULL, 24, 71, 11.5, 13.5, '11,5 a 13,5 g/dL'),
      (2, NULL, 72, 143, 11.5, 15.5, '11,5 a 15,5 g/dL'),
      (2, 'F', 144, 215, 12.0, 16.0, '12 a 16 g/dL'),
      (2, 'M', 144, 215, 13.0, 16.0, '13 a 16 g/dL'),
      (4, NULL, 0, 0, 39, 67, '39 a 67 %'),
      (4, NULL, 1, 1, 31, 55, '31 a 55 %'),
      (4, NULL, 2, 2, 28, 42, '28 a 42 %'),
      (4, NULL, 3, 5, 29, 42, '29 a 42 %'),
      (4, NULL, 6, 23, 33, 39, '33 a 39 %'),
      (4, NULL, 24, 71, 34, 40, '34 a 40 %'),
      (4, NULL, 72, 143, 35, 45, '35 a 45 %'),
      (4, 'F', 144, 215, 36, 46, '36 a 46 %'),
      (4, 'M', 144, 215, 37, 49, '37 a 49 %'),
      (5, NULL, 0, 0, 86, 126, '86 a 126 um3'),
      (5, NULL, 1, 1, 85, 123, '85 a 123 um3'),
      (5, NULL, 2, 2, 77, 105, '77 a 105 um3'),
      (5, NULL, 3, 5, 74, 108, '74 a 108 um3'),
      (5, NULL, 6, 23, 70, 86, '70 a 86 um3'),
      (5, NULL, 24, 71, 75, 87, '75 a 87 um3'),
      (5, NULL, 72, 143, 77, 95, '77 a 95 um3'),
      (5, 'F', 144, 215, 78, 102, '78 a 102 um3'),
      (5, 'M', 144, 215, 78, 98, '78 a 98 um3'),
      (6, NULL, 0, 0, 28, 40, '28 a 40 pg'),
      (6, NULL, 1, 1, 28, 40, '28 a 40 pg'),
      (6, NULL, 2, 2, 26, 34, '26 a 34 pg'),
      (6, NULL, 3, 5, 25, 35, '25 a 35 pg'),
      (6, NULL, 6, 23, 23, 31, '23 a 31 pg'),
      (6, NULL, 24, 71, 24, 30, '24 a 30 pg'),
      (6, NULL, 72, 143, 25, 33, '25 a 33 pg'),
      (6, NULL, 144, 215, 25, 35, '25 a 35 pg'),
      (7, NULL, 0, 0, 28, 38, '28 a 38 %'),
      (7, NULL, 1, 1, 29, 37, '29 a 37 %'),
      (7, NULL, 2, 2, 29, 37, '29 a 37 %'),
      (7, NULL, 3, 5, 30, 36, '30 a 36 %'),
      (7, NULL, 6, 23, 30, 36, '30 a 36 %'),
      (7, NULL, 24, 71, 31, 37, '31 a 37 %'),
      (7, NULL, 72, 143, 31, 37, '31 a 37 %'),
      (7, NULL, 144, 215, 31, 37, '31 a 37 %'),
      (8, NULL, 0, 0, 250, 600, '250 a 600 mil/mm3'),
      (8, NULL, 1, 1, 250, 500, '250 a 500 mil/mm3'),
      (8, NULL, 2, 2, 250, 500, '250 a 500 mil/mm3'),
      (8, NULL, 3, 5, 200, 500, '200 a 500 mil/mm3'),
      (8, NULL, 6, 23, 200, 500, '200 a 500 mil/mm3'),
      (8, NULL, 156, NULL, 140, 400, '140 a 400 mil/mm3'),
      (9, NULL, 0, 0, 5.0, 30.0, '5 a 30 mil/mm3'),
      (9, NULL, 1, 2, 6.0, 17.5, '6 a 17,5 mil/mm3'),
      (9, NULL, 3, 5, 6.0, 17.5, '6 a 17,5 mil/mm3'),
      (9, NULL, 6, 23, 6.0, 17.0, '6 a 17 mil/mm3'),
      (9, NULL, 24, 35, 5.5, 15.5, '5,5 a 15,5 mil/mm3'),
      (9, NULL, 36, 71, 5.0, 14.5, '5 a 14,5 mil/mm3'),
      (9, NULL, 72, 155, 5.0, 13.0, '5 a 13 mil/mm3'),
      (9, NULL, 156, NULL, 5.0, 10.0, '5 a 10 mil/mm3'),
      (23, NULL, 0, 0, 20, 1100, '20 a 1100 /mm3'),
      (23, NULL, 1, 2, 70, 800, '70 a 800 /mm3'),
      (23, NULL, 3, 5, 70, 750, '70 a 750 /mm3'),
      (23, NULL, 6, 23, 40, 650, '40 a 650 /mm3'),
      (23, NULL, 24, 35, 20, 650, '20 a 650 /mm3'),
      (23, NULL, 36, 71, 20, 650, '20 a 650 /mm3'),
      (23, NULL, 72, 155, 0, 600, '0 a 600 /mm3'),
      (23, NULL, 156, NULL, 0, 600, '0 a 600 /mm3'),
      (25, NULL, 0, 0, 2000, 17000, '2000 a 17000 /mm3'),
      (25, NULL, 1, 2, 3500, 14500, '3500 a 14500 /mm3'),
      (25, NULL, 3, 5, 4000, 13500, '4000 a 13500 /mm3'),
      (25, NULL, 6, 23, 3000, 9500, '3000 a 9500 /mm3'),
      (25, NULL, 24, 35, 2000, 8000, '2000 a 8000 /mm3'),
      (25, NULL, 36, 71, 1500, 7000, '1500 a 7000 /mm3'),
      (25, NULL, 72, 155, 1200, 6000, '1200 a 6000 /mm3'),
      (25, NULL, 156, NULL, 1000, 5000, '1000 a 5000 /mm3'),
      (27, NULL, 0, 0, 200, 3100, '200 a 3100 /mm3'),
      (27, NULL, 1, 2, 150, 1500, '150 a 1500 /mm3'),
      (27, NULL, 3, 5, 150, 1500, '150 a 1500 /mm3'),
      (27, NULL, 6, 23, 150, 1300, '150 a 1300 /mm3'),
      (27, NULL, 24, 35, 150, 1300, '150 a 1300 /mm3'),
      (27, NULL, 36, 71, 150, 1300, '150 a 1300 /mm3'),
      (27, NULL, 72, 155, 150, 1300, '150 a 1300 /mm3'),
      (27, NULL, 156, NULL, 80, 1200, '80 a 1200 /mm3'),
      (21, NULL, 156, NULL, 0, 1000, '0 a 1000 /mm3'),
      (22, NULL, 156, NULL, 1800, 7000, '1800 a 7000 /mm3')
    ) AS v(ord, sx, amin, amax, lo, hi, txt)
    JOIN public.exam_parameters p ON p.exam_id = novo AND p.display_order = v.ord;
END $$;
