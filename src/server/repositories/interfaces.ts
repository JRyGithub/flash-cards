import type {
  Card,
  CardDirection,
  DueCounts,
  Note,
  NodeKind,
  ReviewLog,
  SchedulingState,
  Settings,
  TreeNode,
} from "../domain/types"

export interface NewNode {
  id?: string
  parentId: string | null
  kind: NodeKind
  name: string
  description?: string | null
  position: number
}

export interface NodeRepository {
  findById(id: string): Promise<TreeNode | null>
  listAll(): Promise<TreeNode[]>
  listChildren(parentId: string | null): Promise<TreeNode[]>
  /** Root first, ending with the node itself. */
  listAncestors(id: string): Promise<TreeNode[]>
  /** The node's id and every descendant id. */
  listSubtreeIds(id: string): Promise<string[]>
  nextPosition(parentId: string | null): Promise<number>
  create(input: NewNode): Promise<TreeNode>
  update(
    id: string,
    patch: Partial<Pick<TreeNode, "name" | "description" | "parentId" | "position">>,
  ): Promise<TreeNode>
  delete(id: string): Promise<void>
}

export interface NewNote {
  id?: string
  nodeId: string
  frontMd: string
  backMd: string
  reversible: boolean
}

export interface NoteRepository {
  findById(id: string): Promise<Note | null>
  listByNode(nodeId: string): Promise<Note[]>
  listByNodes(nodeIds: readonly string[]): Promise<Note[]>
  createMany(input: readonly NewNote[]): Promise<Note[]>
  update(id: string, patch: Partial<Pick<Note, "frontMd" | "backMd" | "reversible">>): Promise<Note>
  delete(id: string): Promise<void>
}

export interface NewCard {
  noteId: string
  direction: CardDirection
  /** Omitted for brand-new cards; supplied when restoring an export. */
  scheduling?: SchedulingState
  id?: string
}

export interface DueWindow {
  now: Date
  /** Learning cards due before this are considered due. */
  learnAheadUntil: Date
  /** Review cards due before the end of the study day are considered due. */
  endOfDay: Date
}

export interface CardRepository {
  findById(id: string): Promise<Card | null>
  listByNotes(noteIds: readonly string[]): Promise<Card[]>
  createMany(input: readonly NewCard[]): Promise<Card[]>
  updateScheduling(id: string, scheduling: SchedulingState): Promise<Card>
  deleteByNoteAndDirection(noteId: string, direction: CardDirection): Promise<void>
  /** Learning/relearning cards in the nodes due before `before`, soonest first. */
  findLearningDue(nodeIds: readonly string[], before: Date, limit: number): Promise<Card[]>
  /** Review cards in the nodes due before `before`, most overdue first. */
  findReviewDue(nodeIds: readonly string[], before: Date, limit: number): Promise<Card[]>
  /** New cards in the nodes, in creation order. */
  findNew(nodeIds: readonly string[], limit: number): Promise<Card[]>
  /** Raw (un-capped) due counts per node for every node that has cards. */
  countDueByNode(window: DueWindow): Promise<Map<string, DueCounts>>
  /** Earliest due time among learning cards in the nodes, if any. */
  nextLearningDueAt(nodeIds: readonly string[]): Promise<Date | null>
}

export type NewReviewLog = Omit<ReviewLog, "id"> & { id?: string }

export interface ReviewLogRepository {
  create(input: NewReviewLog): Promise<void>
  createMany(input: readonly NewReviewLog[]): Promise<void>
  listByCards(cardIds: readonly string[]): Promise<ReviewLog[]>
  /** How many new cards were introduced and reviews done since `since`. */
  countSince(since: Date): Promise<{ newIntroduced: number; reviewsDone: number }>
}

export interface SettingsRepository {
  get(): Promise<Settings>
  update(patch: Partial<Settings>): Promise<Settings>
}

export interface Repositories {
  nodes: NodeRepository
  notes: NoteRepository
  cards: CardRepository
  reviewLogs: ReviewLogRepository
  settings: SettingsRepository
}

/** Runs work atomically, handing it repositories bound to the transaction. */
export interface UnitOfWork {
  transaction<T>(work: (repos: Repositories) => Promise<T>): Promise<T>
}

export interface Clock {
  now(): Date
}
