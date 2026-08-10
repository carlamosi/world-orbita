-- Migration: Add hardcore_exam_progress table for non-capped resumable per-continent exams
CREATE TABLE IF NOT EXISTS public.hardcore_exam_progress (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  continent TEXT NOT NULL,
  current_index INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  wrong INT NOT NULL DEFAULT 0,
  best_combo INT NOT NULL DEFAULT 0,
  combo INT NOT NULL DEFAULT 0,
  queue JSONB NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.hardcore_exam_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own hardcore progress"
  ON public.hardcore_exam_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own hardcore progress"
  ON public.hardcore_exam_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own hardcore progress"
  ON public.hardcore_exam_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hardcore progress"
  ON public.hardcore_exam_progress FOR DELETE
  USING (auth.uid() = user_id);
