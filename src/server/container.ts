import "server-only"

import { getDb } from "./db/client"
import type { Settings } from "./domain/types"
import { createDrizzleRepositories, DrizzleUnitOfWork } from "./repositories/drizzle"
import { createFsrsScheduler } from "./scheduling/fsrs-scheduler"
import type { Scheduler, SchedulerFactory } from "./scheduling/scheduler"
import { createServices, type Services } from "./services"

/** Composition root: the only place that knows which concrete implementations are used. */

const schedulerCache = new Map<string, Promise<Scheduler>>()

const cachedSchedulerFactory: SchedulerFactory = (settings: Settings) => {
  const key = JSON.stringify([settings.desiredRetention, settings.enableFuzz, settings.fsrsWeights])
  let scheduler = schedulerCache.get(key)
  if (!scheduler) {
    scheduler = createFsrsScheduler(settings)
    schedulerCache.set(key, scheduler)
  }
  return scheduler
}

let services: Services | undefined

export function getServices(): Services {
  if (!services) {
    const db = getDb()
    services = createServices({
      repos: createDrizzleRepositories(db),
      uow: new DrizzleUnitOfWork(db),
      clock: { now: () => new Date() },
      schedulerFactory: cachedSchedulerFactory,
    })
  }
  return services
}
