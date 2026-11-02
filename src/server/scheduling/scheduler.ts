import type { Rating, SchedulingState, Settings } from "../domain/types"

export interface ReviewOutcome {
  /** The card's new scheduling state. */
  next: SchedulingState
  /** The card's state before the review, for the review log. */
  previous: SchedulingState
}

/**
 * Spaced-repetition algorithm boundary. Services only depend on this interface, so the
 * algorithm (FSRS today) can be swapped or faked in tests.
 */
export interface Scheduler {
  review(cardId: string, state: SchedulingState, rating: Rating, now: Date): ReviewOutcome
  /** When the card would next be due for each rating. */
  preview(cardId: string, state: SchedulingState, now: Date): Record<Rating, Date>
}

export type SchedulerFactory = (settings: Settings) => Promise<Scheduler>
