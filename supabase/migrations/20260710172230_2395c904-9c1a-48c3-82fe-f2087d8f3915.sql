CREATE INDEX IF NOT EXISTS idx_order_items_exam_id ON public.order_items(exam_id);
CREATE INDEX IF NOT EXISTS idx_results_released_at ON public.results(released_at DESC) WHERE released = true;