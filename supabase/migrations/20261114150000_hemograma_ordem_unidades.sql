-- Hemograma (HG) da empresa modelo, no padrão do laudo do XLAB:
--  * Plaquetas logo depois do CHCM (antes dos leucócitos);
--  * contagens absolutas com unidade /mm3;
--  * subtítulos "Valores Relativos" e "Valores Absolutos".
-- Só roda se o Plaquetas ainda for o último parâmetro (idempotente). Empresas já criadas não mudam.
DO $$
DECLARE m uuid; hg uuid; plaq uuid; last_ord int;
BEGIN
  SELECT id INTO m FROM public.companies WHERE is_template LIMIT 1;
  IF m IS NULL THEN RETURN; END IF;
  SELECT id INTO hg FROM public.exams WHERE company_id = m AND upper(code) = 'HG' LIMIT 1;
  IF hg IS NULL THEN RETURN; END IF;

  SELECT id, display_order INTO plaq, last_ord FROM public.exam_parameters
   WHERE exam_id = hg AND display_order = 28 AND lower(name) LIKE 'plaquetas%' LIMIT 1;
  IF plaq IS NULL THEN RETURN; END IF;

  -- unidade e subtítulos pela ordem atual (antes de mover as plaquetas)
  UPDATE public.exam_parameters SET unit = '/mm3'
   WHERE exam_id = hg AND display_order BETWEEN 18 AND 26 AND (unit IS NULL OR trim(unit) = '');
  UPDATE public.exam_parameters SET group_label = 'Valores Relativos'
   WHERE exam_id = hg AND display_order BETWEEN 9 AND 17;
  UPDATE public.exam_parameters SET group_label = 'Valores Absolutos'
   WHERE exam_id = hg AND display_order BETWEEN 18 AND 27;

  -- Plaquetas passa a ser a 8ª; o restante desce uma posição
  UPDATE public.exam_parameters SET display_order = display_order + 1
   WHERE exam_id = hg AND display_order BETWEEN 8 AND 27;
  UPDATE public.exam_parameters SET display_order = 8 WHERE id = plaq;
END $$;
