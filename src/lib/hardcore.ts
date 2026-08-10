import { COUNTRIES } from "@/lib/countries";
import type { Country } from "@/types/country";
import { supabase } from "@/integrations/supabase/client";
import { db, isBrowser } from "@/lib/db/orbita-db";

export type HardcoreQuestionType = "locate" | "name" | "countryToCap" | "capToCountry";

export interface HardcoreQuestionItem {
  id: string; // `${iso3}-${type}`
  iso3: string;
  countryName: string;
  type: HardcoreQuestionType;
  capital?: string;
  coordinates: [number, number];
}

export interface HardcoreExamState {
  continent: string;
  currentIndex: number;
  totalQuestions: number;
  score: number;
  correct: number;
  wrong: number;
  bestCombo: number;
  combo: number;
  queue: HardcoreQuestionItem[];
  answers: ("idle" | "correct" | "wrong")[];
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export function generateHardcoreExam(continent: string): HardcoreQuestionItem[] {
  const contCountries = COUNTRIES.filter((c) => c.continent === continent);
  const queue: HardcoreQuestionItem[] = [];

  for (const c of contCountries) {
    // 1. Locate (Globe Click)
    queue.push({
      id: `${c.iso3}-locate`,
      iso3: c.iso3,
      countryName: c.name,
      type: "locate",
      coordinates: c.coordinates,
    });

    // 2. Name (Type Country Name)
    queue.push({
      id: `${c.iso3}-name`,
      iso3: c.iso3,
      countryName: c.name,
      type: "name",
      coordinates: c.coordinates,
    });

    // 3. Country -> Capital (Type Capital)
    if (c.capital) {
      queue.push({
        id: `${c.iso3}-countryToCap`,
        iso3: c.iso3,
        countryName: c.name,
        type: "countryToCap",
        capital: c.capital,
        coordinates: c.coordinates,
      });
    }

    // 4. Capital -> Country (Type Country)
    if (c.capital) {
      queue.push({
        id: `${c.iso3}-capToCountry`,
        iso3: c.iso3,
        countryName: c.name,
        type: "capToCountry",
        capital: c.capital,
        coordinates: c.coordinates,
      });
    }
  }

  return shuffle(queue);
}

export async function loadHardcoreProgress(continent: string): Promise<HardcoreExamState | null> {
  if (!isBrowser()) return null;
  try {
    const local = await db().hardcore_progress.get(continent);
    if (local) return local as unknown as HardcoreExamState;
  } catch {
    // Local DB fallback
  }

  // Cloud fallback from Supabase
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes.user) {
      const id = `${userRes.user.id}_${continent}`;
      const { data } = await supabase
        .from("hardcore_exam_progress")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (data) {
        const state: HardcoreExamState = {
          continent: data.continent,
          currentIndex: data.current_index,
          totalQuestions: data.total_questions,
          score: data.score,
          correct: data.correct,
          wrong: data.wrong,
          bestCombo: data.best_combo,
          combo: data.combo,
          queue: data.queue as unknown as HardcoreQuestionItem[],
          answers: data.answers as unknown as ("idle" | "correct" | "wrong")[],
          startedAt: new Date(data.started_at).getTime(),
          updatedAt: new Date(data.updated_at).getTime(),
          completedAt: data.completed_at ? new Date(data.completed_at).getTime() : null,
        };
        // Cache locally
        await db().hardcore_progress.put(state as any);
        return state;
      }
    }
  } catch (e) {
    console.warn("[hardcore] cloud load failed", e);
  }

  return null;
}

export async function saveHardcoreProgress(state: HardcoreExamState): Promise<void> {
  if (!isBrowser()) return;
  try {
    await db().hardcore_progress.put(state as any);
  } catch (e) {
    console.warn("[hardcore] local save failed", e);
  }

  // Sync to Supabase in background
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes.user) {
      const id = `${userRes.user.id}_${state.continent}`;
      await supabase.from("hardcore_exam_progress").upsert({
        id,
        user_id: userRes.user.id,
        continent: state.continent,
        current_index: state.currentIndex,
        total_questions: state.totalQuestions,
        score: state.score,
        correct: state.correct,
        wrong: state.wrong,
        best_combo: state.bestCombo,
        combo: state.combo,
        queue: state.queue as any,
        answers: state.answers as any,
        started_at: new Date(state.startedAt).toISOString(),
        updated_at: new Date(state.updatedAt).toISOString(),
        completed_at: state.completedAt ? new Date(state.completedAt).toISOString() : null,
      });
    }
  } catch (e) {
    console.warn("[hardcore] cloud sync failed", e);
  }
}

export async function clearHardcoreProgress(continent: string): Promise<void> {
  if (!isBrowser()) return;
  try {
    await db().hardcore_progress.delete(continent);
  } catch {}

  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes.user) {
      const id = `${userRes.user.id}_${continent}`;
      await supabase.from("hardcore_exam_progress").delete().eq("id", id);
    }
  } catch {}
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
