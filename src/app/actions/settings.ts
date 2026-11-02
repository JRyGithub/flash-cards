"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { settingsSchema } from "@/lib/validation"

import { ownerAction } from "./safe-action"

export async function updateSettings(input: z.input<typeof settingsSchema>) {
  const result = await ownerAction(settingsSchema, input, async (data, s) => {
    await s.settings.update(data)
  })
  if (result.ok) refresh()
  return result
}
