import { d as db, a as currentDbName } from './orbita-db-Bdp3ClIj.mjs';
import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { c as cn } from './router-T2jDQtma.mjs';

function assess(attempt) {
  const { validationResult, responseMs, attemptNumber, hintsUsed, questionType, overdueMs } = attempt;
  if (!validationResult.correct) {
    return 0;
  }
  let grade = 2;
  if (validationResult.softCorrect) {
    grade = 1;
  }
  if (attemptNumber >= 2) {
    grade = Math.min(grade, 1);
  }
  if (hintsUsed > 0) {
    grade = Math.min(grade, 1);
  }
  let isVeryFast = false;
  let isSlow = false;
  if (questionType === "location") {
    if (responseMs < 2e3) isVeryFast = true;
    else if (responseMs >= 12e3) isSlow = true;
  } else if (questionType === "capital") {
    if (responseMs < 4e3) isVeryFast = true;
    else if (responseMs >= 2e4) isSlow = true;
  } else if (questionType === "flag") {
    if (responseMs < 1500) isVeryFast = true;
    else if (responseMs >= 8e3) isSlow = true;
  } else {
    if (responseMs < 2e3) isVeryFast = true;
    else if (responseMs >= 15e3) isSlow = true;
  }
  if (isVeryFast && grade === 2) {
    grade = 3;
  } else if (isSlow) {
    grade = Math.max(0, grade - 1);
  }
  if (grade === 2 && overdueMs > 0 && overdueMs < 7 * 864e5 && // Not severely overdue
  attemptNumber === 1 && hintsUsed === 0 && !validationResult.softCorrect) {
    grade = 3;
  }
  return Math.min(3, Math.max(0, grade));
}

function activeUserId() {
  const name = currentDbName();
  if (name === "orbita-local") return null;
  return name.replace(/^orbita-/, "") || null;
}
async function getConceptProgress(conceptId) {
  return await db().concept_progress.get(conceptId);
}
async function recordConceptAttempt(progressRow, historyRow) {
  await db().transaction("rw", db().concept_progress, db().question_history, db().outbox, async () => {
    const userId = activeUserId();
    progressRow.user_id = userId;
    progressRow.dirty = 1;
    progressRow.updated_at = Date.now();
    await db().concept_progress.put(progressRow);
    await db().question_history.put(historyRow);
    const now = Date.now();
    await db().outbox.bulkAdd([
      {
        op_id: crypto.randomUUID(),
        entity: "concept_progress",
        op: "upsert",
        payload: progressRow,
        created_at: now,
        attempts: 0,
        next_attempt_at: 0,
        status: "pending"
      },
      {
        op_id: historyRow.op_id,
        // reuse the same op_id as the history row for idempotency
        entity: "question_history",
        op: "insert",
        payload: historyRow,
        created_at: now,
        attempts: 0,
        next_attempt_at: 0,
        status: "pending"
      }
    ]);
  });
}

const CONTINENTS = ["All", "Africa", "Americas", "Asia", "Europe", "Oceania"];
const STORAGE_KEY = "orbita.continentPref";
function loadContinentPref() {
  if (typeof window === "undefined") return "All";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return CONTINENTS.includes(v ?? "") ? v : "All";
}
function saveContinentPref(v) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, v);
}
function ContinentSelect({
  value,
  onChange,
  className
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: cn(
        "glass rounded-full p-1 flex flex-nowrap items-center gap-0.5 overflow-x-auto",
        "scrollbar-none whitespace-nowrap w-fit max-w-full",
        className
      ),
      role: "tablist",
      "aria-label": "Filter by continent",
      children: CONTINENTS.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": value === c,
          onClick: () => {
            saveContinentPref(c);
            onChange(c);
          },
          className: cn(
            "shrink-0 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors",
            value === c ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
          ),
          children: c
        },
        c
      ))
    }
  );
}
function useContinentPref() {
  const [v, setV] = reactExports.useState(() => loadContinentPref());
  return [v, setV];
}

export { ContinentSelect as C, assess as a, getConceptProgress as g, recordConceptAttempt as r, useContinentPref as u };
