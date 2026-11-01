
-- Backfill orders with NULL insurance_plan_id to point at each company's particular plan
UPDATE public.orders o
SET insurance_plan_id = ip.id
FROM public.insurance_plans ip
WHERE o.insurance_plan_id IS NULL
  AND ip.company_id = o.company_id
  AND ip.is_particular = true;
