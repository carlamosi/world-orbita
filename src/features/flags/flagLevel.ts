import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";
import { parseConceptId } from "@/lib/fsrs/concept";
import { learningStepsOf, normalizeState } from "@/lib/fsrs/adapter";

export interface FlagQuestionLevel {
  /** Pick among options (recognition), else type (recall). */
  showOptions: boolean;
  /** Options come from flags that look alike. */
  lookalikes: boolean;
  /** A typed card shown with options as support; a right pick counts as Hard. */
  scaffold: boolean;
}

/**
 * The level of one flag question, from the card it grades:
 * 1. recognition card, never right yet: regular options;
 * 2. recognition card right once (or graduated): look-alike options;
 * 3. recall card, or an options card whose typed sibling was answered: typing, unless it is still hard (its retry in this session,
 *    or missed again after lapsing twice): look-alike options as support.
 */
export function flagQuestionLevel(
  conceptId: string | undefined,
  concept: ConceptProgressRow | undefined,
  retriedThisSession: boolean,
  /** The typed sibling of this options card was already answered (see learnedRecallSiblings). */
  typedSibling = false,
): FlagQuestionLevel {
  const state = concept ? normalizeState(concept.fsrs_state) : State.New;
  const recall = parseConceptId(conceptId ?? "").subMode === "flagToType";
  if (recall) {
    const scaffold =
      retriedThisSession || (state === State.Relearning && (concept?.fsrs_lapses ?? 0) >= 2);
    return { showOptions: scaffold, lookalikes: scaffold, scaffold };
  }
  // Already answered typed: asking it with options again would be a step back.
  if (typedSibling) return { showOptions: false, lookalikes: false, scaffold: false };
  const rightOnce =
    !!concept &&
    (state === State.Review || (state === State.Learning && learningStepsOf(concept, state) >= 1));
  return { showOptions: true, lookalikes: rightOnce, scaffold: false };
}
