import {
  DefaultScheduler,
  type DefaultSchedulerCardInput,
  type DefaultScheduler as FsrsInstance,
} from "ts-fsrs"

import { CardState, type Rating, type SchedulingState, type Settings } from "../domain/types"
import type { ReviewOutcome, Scheduler, SchedulerFactory } from "./scheduler"

type FsrsCard = DefaultSchedulerCardInput<"FSRS-7">

/** Adapter from our persisted card state to ts-fsrs (FSRS-7 with Anki-style learning steps). */
export class FsrsScheduler implements Scheduler {
  constructor(private readonly fsrs: FsrsInstance<"FSRS-7">) {}

  review(cardId: string, state: SchedulingState, rating: Rating, now: Date): ReviewOutcome {
    const { card } = this.fsrs.review({ card: toFsrs(cardId, state), grade: rating, now })
    return { previous: state, next: fromFsrs(card) }
  }

  preview(cardId: string, state: SchedulingState, now: Date): Record<Rating, Date> {
    const result = {} as Record<Rating, Date>
    for (const item of this.fsrs.preview({ card: toFsrs(cardId, state), now })) {
      result[item.grade as Rating] = item.card.dueAt
    }
    return result
  }
}

export const createFsrsScheduler: SchedulerFactory = async (settings: Settings) => {
  const fsrs = await DefaultScheduler({
    version: "FSRS-7",
    desiredRetention: settings.desiredRetention,
    enableFuzz: settings.enableFuzz,
    // Anki-style: new and lapsed cards always walk their learning steps before graduating,
    // rather than FSRS-7's default of letting long model intervals skip them.
    learningSteps: ["1m", "10m"],
    relearningSteps: ["10m"],
    allowModelOverride: false,
    ...(settings.fsrsWeights?.length ? { weights: settings.fsrsWeights } : {}),
  })
  return new FsrsScheduler(fsrs)
}

function scheduleStatus(state: number): FsrsCard["scheduleStatus"] {
  if (state === CardState.New) return "new"
  if (state === CardState.Review) return "review"
  return "learning"
}

function toFsrs(cardId: string, s: SchedulingState): FsrsCard {
  return {
    cardId,
    state: s.state as FsrsCard["state"],
    scheduleStatus: scheduleStatus(s.state),
    dueAt: s.dueAt,
    lastReviewAt: s.lastReviewAt,
    stability: s.stability,
    stabilityFast: s.stabilityFast,
    difficulty: s.difficulty,
    scheduledDays: s.scheduledDays,
    learningStep: s.learningStep,
    reps: s.reps,
    lapses: s.lapses,
  }
}

function fromFsrs(c: {
  state: number
  dueAt: Date
  lastReviewAt: Date | null
  stability: number
  stabilityFast: number
  difficulty: number
  scheduledDays: number
  learningStep: number
  reps: number
  lapses: number
}): SchedulingState {
  return {
    state: c.state,
    dueAt: c.dueAt,
    lastReviewAt: c.lastReviewAt,
    stability: c.stability,
    stabilityFast: c.stabilityFast,
    difficulty: c.difficulty,
    scheduledDays: c.scheduledDays,
    learningStep: c.learningStep,
    reps: c.reps,
    lapses: c.lapses,
  }
}
