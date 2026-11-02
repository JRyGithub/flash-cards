/*
 * Domain types. These are deliberately independent of Drizzle so services and their
 * tests only depend on these shapes (Drizzle rows are structurally compatible).
 */

export type NodeKind = "tree" | "branch" | "leaf"

export interface TreeNode {
  id: string
  parentId: string | null
  kind: NodeKind
  name: string
  description: string | null
  position: number
  createdAt: Date
  updatedAt: Date
}

export interface Note {
  id: string
  nodeId: string
  frontMd: string
  backMd: string
  reversible: boolean
  createdAt: Date
  updatedAt: Date
}

export type CardDirection = "forward" | "reverse"

export const CardState = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const
export type CardState = (typeof CardState)[keyof typeof CardState]

export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const
export type Rating = (typeof Rating)[keyof typeof Rating]
export const RATINGS: readonly Rating[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]

/** The scheduler-owned part of a card. */
export interface SchedulingState {
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
}

export interface Card extends SchedulingState {
  id: string
  noteId: string
  direction: CardDirection
  createdAt: Date
}

export interface ReviewLog {
  id: string
  cardId: string
  rating: number
  state: number
  dueAt: Date
  stability: number
  stabilityFast: number
  difficulty: number
  scheduledDays: number
  learningStep: number
  reviewedAt: Date
  durationMs: number | null
}

export interface Settings {
  desiredRetention: number
  newCardsPerDay: number
  maxReviewsPerDay: number
  enableFuzz: boolean
  fsrsWeights: number[] | null
  timezone: string
}

export interface DueCounts {
  new: number
  learning: number
  review: number
}

export const EMPTY_COUNTS: DueCounts = { new: 0, learning: 0, review: 0 }
