import { NotFoundError } from "../domain/errors"
import { rollUpCounts, rollUpTotals } from "../domain/hierarchy"
import { formatInterval, LEARN_AHEAD_MS, studyDayBounds } from "../domain/time"
import {
  type Card,
  type CardDirection,
  type DueCounts,
  RATINGS,
  type Rating,
  type Settings,
} from "../domain/types"
import type { Clock, DueWindow, Repositories, UnitOfWork } from "../repositories/interfaces"
import type { SchedulerFactory } from "../scheduling/scheduler"

export interface StudyCard {
  cardId: string
  noteId: string
  nodeId: string
  direction: CardDirection
  state: number
  promptMd: string
  answerMd: string
  /** Interval label per rating, e.g. { 1: "1m", 2: "6m", 3: "10m", 4: "4d" }. */
  intervals: Record<Rating, string>
}

/** A card for practice, which shows cards without scheduling them. */
export type PracticeCard = Pick<
  StudyCard,
  "cardId" | "noteId" | "nodeId" | "direction" | "promptMd" | "answerMd"
>

export interface StudyState {
  current: StudyCard | null
  remaining: DueCounts
  /** When nothing is due right now: the next time a learning card in this subtree comes due today. */
  nextLearningDueAt: Date | null
}

interface DailyBudget {
  settings: Settings
  window: DueWindow
  newRemaining: number
  reviewRemaining: number
}

type StudyRepos = Pick<Repositories, "nodes" | "notes" | "cards" | "reviewLogs" | "settings">

export class StudyService {
  constructor(
    private readonly deps: StudyRepos & {
      uow: UnitOfWork
      clock: Clock
      schedulerFactory: SchedulerFactory
    },
  ) {}

  /** Due counts for every node, including all descendants, capped by today's limits. */
  async countsForAll(): Promise<Map<string, DueCounts>> {
    const budget = await this.budget()
    const [nodes, own] = await Promise.all([
      this.deps.nodes.listAll(),
      this.deps.cards.countDueByNode(budget.window),
    ])
    const totals = rollUpCounts(nodes, own)
    for (const [id, counts] of totals) totals.set(id, cap(counts, budget))
    return totals
  }

  /** Total cards for every node, including all descendants, whether due or not. */
  async cardTotalsForAll(): Promise<Map<string, number>> {
    const [nodes, own] = await Promise.all([
      this.deps.nodes.listAll(),
      this.deps.cards.countByNode(),
    ])
    return rollUpTotals(nodes, own)
  }

  /** Every card in the node and its descendants, in note order, for unscheduled practice. */
  async practiceDeck(nodeId: string): Promise<PracticeCard[]> {
    const node = await this.deps.nodes.findById(nodeId)
    if (!node) throw new NotFoundError("Node", nodeId)

    const subtree = await this.deps.nodes.listSubtreeIds(nodeId)
    const notes = await this.deps.notes.listByNodes(subtree)
    const byNote = new Map(notes.map((n) => [n.id, n]))
    const cards = await this.deps.cards.listByNotes(notes.map((n) => n.id))
    const order = new Map(notes.map((n, i) => [n.id, i]))
    cards.sort(
      (a, b) =>
        order.get(a.noteId)! - order.get(b.noteId)! || a.direction.localeCompare(b.direction),
    )
    return cards.map((card) => {
      const note = byNote.get(card.noteId)!
      const forward = card.direction === "forward"
      return {
        cardId: card.id,
        noteId: note.id,
        nodeId: note.nodeId,
        direction: card.direction,
        promptMd: forward ? note.frontMd : note.backMd,
        answerMd: forward ? note.backMd : note.frontMd,
      }
    })
  }

  /** The next card to study from the node and its descendants. */
  async next(nodeId: string): Promise<StudyState> {
    const node = await this.deps.nodes.findById(nodeId)
    if (!node) throw new NotFoundError("Node", nodeId)

    const budget = await this.budget()
    const subtree = await this.deps.nodes.listSubtreeIds(nodeId)
    const [card, remaining] = await Promise.all([
      this.pickCard(subtree, budget),
      this.remainingIn(subtree, budget),
    ])

    if (card) {
      return { current: await this.toStudyCard(card, budget), remaining, nextLearningDueAt: null }
    }
    const nextDue = await this.deps.cards.nextLearningDueAt(subtree)
    return {
      current: null,
      remaining,
      nextLearningDueAt: nextDue && nextDue < budget.window.endOfDay ? nextDue : null,
    }
  }

  /** Records a review and returns what to study next. */
  async review(
    nodeId: string,
    cardId: string,
    rating: Rating,
    durationMs: number | null,
  ): Promise<StudyState> {
    const card = await this.deps.cards.findById(cardId)
    if (!card) throw new NotFoundError("Card", cardId)

    const now = this.deps.clock.now()
    const scheduler = await this.deps.schedulerFactory(await this.deps.settings.get())
    const { previous, next } = scheduler.review(card.id, card, rating, now)

    await this.deps.uow.transaction(async ({ cards, reviewLogs }) => {
      await cards.updateScheduling(card.id, next)
      await reviewLogs.create({
        cardId: card.id,
        rating,
        state: previous.state,
        dueAt: previous.dueAt,
        stability: previous.stability,
        stabilityFast: previous.stabilityFast,
        difficulty: previous.difficulty,
        scheduledDays: previous.scheduledDays,
        learningStep: previous.learningStep,
        reviewedAt: now,
        durationMs,
      })
    })

    return this.next(nodeId)
  }

  /**
   * Order: learning cards that are due, then due reviews, then new cards, then learning
   * cards due within the learn-ahead window (so a session doesn't stall on a 1m step).
   */
  private async pickCard(subtree: string[], budget: DailyBudget): Promise<Card | null> {
    const { cards } = this.deps
    const { now, endOfDay, learnAheadUntil } = budget.window
    const candidates: Array<() => Promise<Card[]>> = [
      () => cards.findLearningDue(subtree, now, 1),
      () => cards.findReviewDue(subtree, endOfDay, budget.reviewRemaining > 0 ? 1 : 0),
      () => cards.findNew(subtree, budget.newRemaining > 0 ? 1 : 0),
      () => cards.findLearningDue(subtree, learnAheadUntil, 1),
    ]
    for (const find of candidates) {
      const [card] = await find()
      if (card) return card
    }
    return null
  }

  private async remainingIn(subtree: string[], budget: DailyBudget): Promise<DueCounts> {
    const own = await this.deps.cards.countDueByNode(budget.window)
    const total = { new: 0, learning: 0, review: 0 }
    for (const id of subtree) {
      const c = own.get(id)
      if (!c) continue
      total.new += c.new
      total.learning += c.learning
      total.review += c.review
    }
    return cap(total, budget)
  }

  private async toStudyCard(card: Card, budget: DailyBudget): Promise<StudyCard> {
    const note = await this.deps.notes.findById(card.noteId)
    if (!note) throw new NotFoundError("Note", card.noteId)

    const scheduler = await this.deps.schedulerFactory(budget.settings)
    const now = budget.window.now
    const dueByRating = scheduler.preview(card.id, card, now)
    const intervals = Object.fromEntries(
      RATINGS.map((r) => [r, formatInterval(dueByRating[r].getTime() - now.getTime())]),
    ) as Record<Rating, string>

    const forward = card.direction === "forward"
    return {
      cardId: card.id,
      noteId: note.id,
      nodeId: note.nodeId,
      direction: card.direction,
      state: card.state,
      promptMd: forward ? note.frontMd : note.backMd,
      answerMd: forward ? note.backMd : note.frontMd,
      intervals,
    }
  }

  private async budget(): Promise<DailyBudget> {
    const now = this.deps.clock.now()
    const settings = await this.deps.settings.get()
    const { start, end } = studyDayBounds(now, settings.timezone)
    const done = await this.deps.reviewLogs.countSince(start)
    return {
      settings,
      window: { now, endOfDay: end, learnAheadUntil: new Date(now.getTime() + LEARN_AHEAD_MS) },
      newRemaining: Math.max(0, settings.newCardsPerDay - done.newIntroduced),
      reviewRemaining: Math.max(0, settings.maxReviewsPerDay - done.reviewsDone),
    }
  }
}

function cap(counts: DueCounts, budget: DailyBudget): DueCounts {
  return {
    new: Math.min(counts.new, budget.newRemaining),
    learning: counts.learning,
    review: Math.min(counts.review, budget.reviewRemaining),
  }
}
