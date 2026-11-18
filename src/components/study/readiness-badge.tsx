import { LEVEL_LABEL, type ReadinessLevel } from "@/lib/quiz";
import { Badge } from "../ui";

const TONE = { READY: "success", ALMOST: "warn", NEEDS_WORK: "danger", NOT_STARTED: "neutral" } as const;

/** A student's own readiness for a test or chapter, from their own quizzes. */
export function ReadinessBadge({ percent, level }: { percent: number | null; level: ReadinessLevel }) {
  return <Badge tone={TONE[level]}>{LEVEL_LABEL[level]}{percent !== null && ` · ${percent}%`}</Badge>;
}
