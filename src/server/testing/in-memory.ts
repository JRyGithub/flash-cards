import {
  CardState,
  type Card,
  type DueCounts,
  type Note,
  type ReviewLog,
  type Settings,
  type TreeNode,
} from "../domain/types"
import type {
  CardRepository,
  Clock,
  DueWindow,
  NewCard,
  NewNode,
  NewNote,
  NewReviewLog,
  NodeRepository,
  NoteRepository,
  Repositories,
  ReviewLogRepository,
  SettingsRepository,
  UnitOfWork,
} from "../repositories/interfaces"
import { NotFoundError } from "../domain/errors"
import { createFsrsScheduler } from "../scheduling/fsrs-scheduler"
import { createServices } from "../services"

/** In-memory repositories with the same observable behaviour as the Drizzle ones. */

export class MemoryStore {
  nodes = new Map<string, TreeNode>()
  notes = new Map<string, Note>()
  cards = new Map<string, Card>()
  reviewLogs: ReviewLog[] = []
  settings: Settings = {
    desiredRetention: 0.9,
    newCardsPerDay: 20,
    maxReviewsPerDay: 200,
    enableFuzz: false,
    fsrsWeights: null,
    timezone: "UTC",
  }
  private seq = 0
  constructor(readonly clock: Clock) {}
  nextId(): string {
    this.seq++
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`
  }
}

const sortNodes = (a: TreeNode, b: TreeNode) =>
  a.position - b.position || a.name.localeCompare(b.name)

class MemoryNodeRepository implements NodeRepository {
  constructor(private readonly s: MemoryStore) {}
  async findById(id: string) {
    return this.s.nodes.get(id) ?? null
  }
  async listAll() {
    return [...this.s.nodes.values()].sort(sortNodes)
  }
  async listChildren(parentId: string | null) {
    return [...this.s.nodes.values()].filter((n) => n.parentId === parentId).sort(sortNodes)
  }
  async listAncestors(id: string) {
    const chain: TreeNode[] = []
    let current = this.s.nodes.get(id)
    while (current) {
      chain.unshift(current)
      current = current.parentId ? this.s.nodes.get(current.parentId) : undefined
    }
    return chain
  }
  async listSubtreeIds(id: string) {
    if (!this.s.nodes.has(id)) return []
    const ids = [id]
    for (let i = 0; i < ids.length; i++) {
      for (const n of this.s.nodes.values()) if (n.parentId === ids[i]) ids.push(n.id)
    }
    return ids
  }
  async nextPosition(parentId: string | null) {
    const siblings = await this.listChildren(parentId)
    return siblings.length ? Math.max(...siblings.map((n) => n.position)) + 1 : 0
  }
  async create(input: NewNode) {
    const now = this.s.clock.now()
    const node: TreeNode = {
      id: input.id ?? this.s.nextId(),
      parentId: input.parentId,
      kind: input.kind,
      name: input.name,
      description: input.description ?? null,
      position: input.position,
      createdAt: now,
      updatedAt: now,
    }
    this.s.nodes.set(node.id, node)
    return node
  }
  async update(id: string, patch: Partial<TreeNode>) {
    const node = this.s.nodes.get(id)
    if (!node) throw new NotFoundError("Node", id)
    const updated = { ...node, ...patch, updatedAt: this.s.clock.now() }
    this.s.nodes.set(id, updated)
    return updated
  }
  async delete(id: string) {
    for (const nodeId of await this.listSubtreeIds(id)) {
      for (const note of [...this.s.notes.values()]) {
        if (note.nodeId === nodeId) await new MemoryNoteRepository(this.s).delete(note.id)
      }
      this.s.nodes.delete(nodeId)
    }
  }
}

class MemoryNoteRepository implements NoteRepository {
  constructor(private readonly s: MemoryStore) {}
  async findById(id: string) {
    return this.s.notes.get(id) ?? null
  }
  async listByNode(nodeId: string) {
    return [...this.s.notes.values()].filter((n) => n.nodeId === nodeId)
  }
  async listByNodes(nodeIds: readonly string[]) {
    return [...this.s.notes.values()].filter((n) => nodeIds.includes(n.nodeId))
  }
  async createMany(input: readonly NewNote[]) {
    const now = this.s.clock.now()
    return input.map((i) => {
      const note: Note = { ...i, id: i.id ?? this.s.nextId(), createdAt: now, updatedAt: now }
      this.s.notes.set(note.id, note)
      return note
    })
  }
  async update(id: string, patch: Partial<Note>) {
    const note = this.s.notes.get(id)
    if (!note) throw new NotFoundError("Note", id)
    const updated = { ...note, ...patch, updatedAt: this.s.clock.now() }
    this.s.notes.set(id, updated)
    return updated
  }
  async delete(id: string) {
    this.s.notes.delete(id)
    for (const card of [...this.s.cards.values()]) {
      if (card.noteId === id) {
        this.s.cards.delete(card.id)
        this.s.reviewLogs = this.s.reviewLogs.filter((l) => l.cardId !== card.id)
      }
    }
  }
}

class MemoryCardRepository implements CardRepository {
  constructor(private readonly s: MemoryStore) {}
  private inNodes(nodeIds: readonly string[]) {
    return [...this.s.cards.values()].filter((c) =>
      nodeIds.includes(this.s.notes.get(c.noteId)!.nodeId),
    )
  }
  async findById(id: string) {
    return this.s.cards.get(id) ?? null
  }
  async listByNotes(noteIds: readonly string[]) {
    return [...this.s.cards.values()].filter((c) => noteIds.includes(c.noteId))
  }
  async createMany(input: readonly NewCard[]) {
    const now = this.s.clock.now()
    return input.map((i) => {
      const card: Card = {
        id: i.id ?? this.s.nextId(),
        noteId: i.noteId,
        direction: i.direction,
        createdAt: now,
        ...(i.scheduling ?? {
          state: CardState.New,
          dueAt: now,
          lastReviewAt: null,
          stability: 0,
          stabilityFast: 0,
          difficulty: 0,
          scheduledDays: 0,
          learningStep: 0,
          reps: 0,
          lapses: 0,
        }),
      }
      this.s.cards.set(card.id, card)
      return card
    })
  }
  async updateScheduling(id: string, scheduling: Card) {
    const card = this.s.cards.get(id)
    if (!card) throw new NotFoundError("Card", id)
    const updated = { ...card, ...scheduling, id, noteId: card.noteId, direction: card.direction }
    this.s.cards.set(id, updated)
    return updated
  }
  async deleteByNoteAndDirection(noteId: string, direction: string) {
    for (const c of [...this.s.cards.values()]) {
      if (c.noteId === noteId && c.direction === direction) this.s.cards.delete(c.id)
    }
  }
  async findLearningDue(nodeIds: readonly string[], before: Date, limit: number) {
    return this.inNodes(nodeIds)
      .filter(
        (c) =>
          (c.state === CardState.Learning || c.state === CardState.Relearning) && c.dueAt < before,
      )
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, limit)
  }
  async findReviewDue(nodeIds: readonly string[], before: Date, limit: number) {
    return this.inNodes(nodeIds)
      .filter((c) => c.state === CardState.Review && c.dueAt < before)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, limit)
  }
  async findNew(nodeIds: readonly string[], limit: number) {
    return this.inNodes(nodeIds)
      .filter((c) => c.state === CardState.New)
      .slice(0, limit)
  }
  async countDueByNode(w: DueWindow) {
    const counts = new Map<string, DueCounts>()
    for (const c of this.s.cards.values()) {
      const nodeId = this.s.notes.get(c.noteId)!.nodeId
      const entry = counts.get(nodeId) ?? { new: 0, learning: 0, review: 0 }
      if (c.state === CardState.New) entry.new++
      else if (c.state === CardState.Review) entry.review += c.dueAt < w.endOfDay ? 1 : 0
      else entry.learning += c.dueAt < w.learnAheadUntil ? 1 : 0
      counts.set(nodeId, entry)
    }
    return counts
  }
  async countByNode() {
    const totals = new Map<string, number>()
    for (const c of this.s.cards.values()) {
      const nodeId = this.s.notes.get(c.noteId)!.nodeId
      totals.set(nodeId, (totals.get(nodeId) ?? 0) + 1)
    }
    return totals
  }
  async nextLearningDueAt(nodeIds: readonly string[]) {
    const [first] = await this.findLearningDue(nodeIds, new Date(8.64e15), 1)
    return first?.dueAt ?? null
  }
}

class MemoryReviewLogRepository implements ReviewLogRepository {
  constructor(private readonly s: MemoryStore) {}
  async create(input: NewReviewLog) {
    this.s.reviewLogs.push({ ...input, id: input.id ?? this.s.nextId() })
  }
  async createMany(input: readonly NewReviewLog[]) {
    for (const i of input) await this.create(i)
  }
  async listByCards(cardIds: readonly string[]) {
    return this.s.reviewLogs.filter((l) => cardIds.includes(l.cardId))
  }
  async countSince(since: Date) {
    const recent = this.s.reviewLogs.filter((l) => l.reviewedAt >= since)
    return {
      newIntroduced: recent.filter((l) => l.state === CardState.New).length,
      reviewsDone: recent.filter((l) => l.state === CardState.Review).length,
    }
  }
}

class MemorySettingsRepository implements SettingsRepository {
  constructor(private readonly s: MemoryStore) {}
  async get() {
    return { ...this.s.settings }
  }
  async update(patch: Partial<Settings>) {
    this.s.settings = { ...this.s.settings, ...patch }
    return this.get()
  }
}

export function createMemoryRepositories(store: MemoryStore): Repositories {
  return {
    nodes: new MemoryNodeRepository(store),
    notes: new MemoryNoteRepository(store),
    cards: new MemoryCardRepository(store),
    reviewLogs: new MemoryReviewLogRepository(store),
    settings: new MemorySettingsRepository(store),
  }
}

export class FakeClock implements Clock {
  constructor(private current: Date = new Date("2026-01-01T09:00:00.000Z")) {}
  now() {
    return new Date(this.current)
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms)
  }
  set(date: Date) {
    this.current = new Date(date)
  }
}

/** Services wired to an in-memory store and a controllable clock. */
export function createTestApp() {
  const clock = new FakeClock()
  const store = new MemoryStore(clock)
  const repos = createMemoryRepositories(store)
  const uow: UnitOfWork = { transaction: (work) => work(repos) }
  const services = createServices({ repos, uow, clock, schedulerFactory: createFsrsScheduler })
  return { clock, store, repos, services }
}
