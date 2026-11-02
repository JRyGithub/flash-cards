import { type ParseIssue, parseCardCsv } from "@/lib/card-csv"

import { ValidationError } from "../domain/errors"
import type { NoteService } from "./note-service"

export interface ImportResult {
  imported: number
  issues: ParseIssue[]
}

export class ImportService {
  constructor(private readonly deps: { notes: NoteService }) {}

  /** Imports every valid row; invalid rows are skipped and reported back. */
  async importCsv(
    nodeId: string,
    text: string,
    options: { defaultReversible?: boolean } = {},
  ): Promise<ImportResult> {
    const { cards, issues } = parseCardCsv(text, options)
    if (cards.length === 0) throw new ValidationError("No valid cards were found to import")
    await this.deps.notes.createMany(nodeId, cards)
    return { imported: cards.length, issues }
  }
}
