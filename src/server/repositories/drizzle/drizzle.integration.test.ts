import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeEach, describe, expect, it } from "vitest"

import * as schema from "../../db/schema"
import type { Database } from "../../db/types"
import { CardState, Rating } from "../../domain/types"
import { createFsrsScheduler } from "../../scheduling/fsrs-scheduler"
import { createServices } from "../../services"
import { FakeClock } from "../../testing/in-memory"
import { createDrizzleRepositories, DrizzleUnitOfWork } from "."

/*
 * Runs the real migrations (including triggers and RLS) and the Drizzle repositories
 * against an in-process Postgres (PGlite), exercising the same services the app uses.
 */

async function setup() {
  const db = drizzle(new PGlite(), { schema }) as unknown as Database
  await migrate(db as never, { migrationsFolder: "./drizzle" })
  const clock = new FakeClock(new Date("2026-01-01T09:00:00.000Z"))
  const repos = createDrizzleRepositories(db)
  const services = createServices({
    repos,
    uow: new DrizzleUnitOfWork(db),
    clock,
    schedulerFactory: createFsrsScheduler,
  })
  return { db, clock, repos, services }
}

let app: Awaited<ReturnType<typeof setup>>

beforeEach(async () => {
  app = await setup()
}, 30_000)

async function seedTree() {
  const { nodes, notes } = app.services
  const tree = await nodes.createTree({ name: "github-300" })
  const section = await nodes.createChild(tree.id, "branch", { name: "Section 1" })
  const leaf = await nodes.createChild(section.id, "leaf", { name: "Actions" })
  await notes.create(section.id, { frontMd: "Branch Q", backMd: "Branch A", reversible: false })
  await notes.create(leaf.id, { frontMd: "Leaf Q", backMd: "Leaf A", reversible: true })
  return { tree, section, leaf }
}

describe("Drizzle repositories on Postgres", () => {
  it("enables row level security on every table", async () => {
    const result = await app.db.execute(
      sql`select relname, relrowsecurity from pg_class where relname in ('nodes','notes','cards','review_logs','settings')`,
    )
    const rows = (result as unknown as { rows: { relname: string; relrowsecurity: boolean }[] })
      .rows
    expect(rows).toHaveLength(5)
    expect(rows.every((r) => r.relrowsecurity)).toBe(true)
  })

  it("seeds default settings", async () => {
    expect(await app.services.settings.get()).toMatchObject({
      desiredRetention: 0.9,
      newCardsPerDay: 20,
      timezone: "UTC",
    })
  })

  it("walks ancestors and subtrees with recursive queries", async () => {
    const { tree, section, leaf } = await seedTree()
    expect((await app.services.nodes.getPath(leaf.id)).map((n) => n.name)).toEqual([
      "github-300",
      "Section 1",
      "Actions",
    ])
    expect((await app.repos.nodes.listSubtreeIds(tree.id)).sort()).toEqual(
      [tree.id, section.id, leaf.id].sort(),
    )
  })

  it("enforces hierarchy rules in the database even if the service is bypassed", async () => {
    const { tree, section, leaf } = await seedTree()
    await expect(
      app.repos.nodes.create({ parentId: leaf.id, kind: "leaf", name: "x", position: 0 }),
    ).rejects.toThrow()
    await expect(app.repos.nodes.update(section.id, { parentId: leaf.id })).rejects.toThrow()
    await expect(
      app.repos.notes.createMany([
        { nodeId: tree.id, frontMd: "q", backMd: "a", reversible: false },
      ]),
    ).rejects.toThrow()
    await expect(
      app.repos.nodes.create({ parentId: null, kind: "branch", name: "x", position: 0 }),
    ).rejects.toThrow()
  })

  it("rolls back a transaction when part of it fails", async () => {
    const { tree, leaf } = await seedTree()
    const before = await app.repos.notes.listByNode(leaf.id)
    await expect(
      new DrizzleUnitOfWork(app.db).transaction(async (repos) => {
        await repos.notes.createMany([
          { nodeId: leaf.id, frontMd: "q", backMd: "a", reversible: false },
        ])
        // Rejected by the notes trigger, which must undo the insert above.
        await repos.notes.createMany([
          { nodeId: tree.id, frontMd: "q", backMd: "a", reversible: false },
        ])
      }),
    ).rejects.toThrow()
    expect(await app.repos.notes.listByNode(leaf.id)).toEqual(before)
  })

  it("studies a tree end to end: queue, review, counts and daily limits", async () => {
    const { tree, leaf } = await seedTree()

    let counts = await app.services.study.countsForAll()
    expect(counts.get(tree.id)).toEqual({ new: 3, learning: 0, review: 0 })
    expect(counts.get(leaf.id)).toEqual({ new: 2, learning: 0, review: 0 })

    let state = await app.services.study.next(tree.id)
    const first = state.current!
    expect(first.intervals[Rating.Again]).toBe("1m")

    state = await app.services.study.review(tree.id, first.cardId, Rating.Again, 2000)
    const card = await app.repos.cards.findById(first.cardId)
    expect(card).toMatchObject({ state: CardState.Learning, reps: 1, lapses: 0 })
    expect(card!.dueAt.toISOString()).toBe("2026-01-01T09:01:00.000Z")
    expect(state.remaining).toEqual({ new: 2, learning: 1, review: 0 })

    // Graduate everything with Easy.
    for (let i = 0; i < 10 && state.current; i++) {
      state = await app.services.study.review(tree.id, state.current.cardId, Rating.Easy, null)
    }
    expect(state.current).toBeNull()
    expect(state.remaining).toEqual({ new: 0, learning: 0, review: 0 })

    const logs = await app.repos.reviewLogs.countSince(new Date("2026-01-01T00:00:00Z"))
    expect(logs).toEqual({ newIntroduced: 3, reviewsDone: 0 })

    // Weeks later they're due again as reviews.
    app.clock.set(new Date("2026-06-01T09:00:00Z"))
    counts = await app.services.study.countsForAll()
    expect(counts.get(tree.id)).toEqual({ new: 0, learning: 0, review: 3 })
  })

  it("round-trips a JSON export through Postgres", async () => {
    const { tree, leaf } = await seedTree()
    const { current } = await app.services.study.next(leaf.id)
    await app.services.study.review(leaf.id, current!.cardId, Rating.Good, 1000)

    const bundle = JSON.parse(JSON.stringify(await app.services.exports.export(tree.id)))
    const summary = await app.services.exports.import(bundle)
    expect(summary).toEqual({ trees: 1, nodes: 3, notes: 2, cards: 3 })

    const trees = await app.services.nodes.listTrees()
    expect(trees).toHaveLength(2)
    const copy = await app.services.exports.export(trees[1]!.id)
    expect(copy.reviewLogs).toHaveLength(1)
    expect(copy.cards.map((c) => c.state).sort()).toEqual(
      bundle.cards.map((c: { state: number }) => c.state).sort(),
    )
  })

  it("moves, reorders and cascades deletes", async () => {
    const { tree, section, leaf } = await seedTree()
    const second = await app.services.nodes.createChild(tree.id, "branch", { name: "Section 2" })
    await app.services.nodes.move(leaf.id, second.id)
    expect((await app.services.nodes.get(leaf.id)).parentId).toBe(second.id)

    await app.services.nodes.reorder(second.id, "up")
    expect((await app.services.nodes.listChildren(tree.id)).map((n) => n.name)).toEqual([
      "Section 2",
      "Section 1",
    ])

    await app.services.nodes.delete(tree.id)
    expect(await app.repos.nodes.listAll()).toEqual([])
    expect(await app.repos.notes.listByNode(section.id)).toEqual([])
  })
})

describe("database roles", () => {
  const rowsOf = (result: unknown) => (result as { rows: Record<string, unknown>[] }).rows
  /** Drizzle wraps driver errors; the Postgres reason is on `cause`. */
  const pgError = (promise: Promise<unknown>) =>
    promise.then(
      () => "no error",
      (error: Error) => (error.cause as Error | undefined)?.message ?? error.message,
    )

  it("the app role can do everything the app needs, and nothing more", async () => {
    await app.db.execute(sql`set role flash_cards_app`)
    try {
      const { tree, leaf } = await seedTree()
      const { current } = await app.services.study.next(tree.id)
      await app.services.study.review(tree.id, current!.cardId, Rating.Good, 500)
      await app.services.settings.update({ newCardsPerDay: 5 })
      expect((await app.services.study.countsForAll()).get(leaf.id)?.new).toBe(2)
      await app.services.nodes.delete(tree.id)

      expect(await pgError(app.db.execute(sql`create table sneaky (id int)`))).toMatch(
        /permission denied/,
      )
      expect(await pgError(app.db.execute(sql`drop table notes`))).toMatch(/must be owner/)
      expect(
        await pgError(app.db.execute(sql`alter table nodes disable row level security`)),
      ).toMatch(/must be owner/)
    } finally {
      await app.db.execute(sql`reset role`)
    }
  })

  it("roles without a policy see no rows, even with table privileges", async () => {
    await seedTree()
    await app.db.execute(sql`create role api_like nologin`)
    await app.db.execute(sql`grant usage on schema public to api_like`)
    await app.db.execute(sql`grant select, insert on nodes, notes to api_like`)
    await app.db.execute(sql`set role api_like`)
    try {
      expect(rowsOf(await app.db.execute(sql`select * from nodes`))).toEqual([])
      expect(
        await pgError(
          app.db.execute(sql`insert into nodes (kind, name) values ('tree', 'injected')`),
        ),
      ).toMatch(/row-level security/)
    } finally {
      await app.db.execute(sql`reset role`)
    }
  })
})
