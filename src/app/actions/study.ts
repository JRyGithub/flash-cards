"use server"

import { z } from "zod"

import { reviewSchema, uuidSchema } from "@/lib/validation"

import { ownerAction } from "./safe-action"

// Study actions don't refresh the router: the session updates from the returned state,
// and the rest of the app re-renders with fresh counts when navigated back to.

export async function nextCard(nodeId: string) {
  return ownerAction(uuidSchema, nodeId, (id, s) => s.study.next(id))
}

export async function reviewCard(input: z.input<typeof reviewSchema>) {
  return ownerAction(reviewSchema, input, ({ nodeId, cardId, rating, durationMs }, s) =>
    s.study.review(nodeId, cardId, rating, durationMs),
  )
}
