import type { Clock, Repositories, UnitOfWork } from "../repositories/interfaces"
import type { SchedulerFactory } from "../scheduling/scheduler"
import { ExportService } from "./export-service"
import { ImportService } from "./import-service"
import { NodeService } from "./node-service"
import { NoteService } from "./note-service"
import { SettingsService } from "./settings-service"
import { StudyService } from "./study-service"

export interface Services {
  nodes: NodeService
  notes: NoteService
  study: StudyService
  imports: ImportService
  exports: ExportService
  settings: SettingsService
}

/** Wires services to their dependencies. Used by the app container and by tests. */
export function createServices(deps: {
  repos: Repositories
  uow: UnitOfWork
  clock: Clock
  schedulerFactory: SchedulerFactory
}): Services {
  const { repos, uow, clock, schedulerFactory } = deps
  const notes = new NoteService({ nodes: repos.nodes, notes: repos.notes, uow })
  return {
    nodes: new NodeService({ nodes: repos.nodes, uow }),
    notes,
    study: new StudyService({ ...repos, uow, clock, schedulerFactory }),
    imports: new ImportService({ notes }),
    exports: new ExportService({ ...repos, uow }),
    settings: new SettingsService({ settings: repos.settings }),
  }
}
