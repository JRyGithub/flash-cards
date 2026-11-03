"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { serverEnv } from "@/env"
import { isOwner, safeRedirectPath } from "@/server/auth/owner"
import { createSupabaseServerClient } from "@/server/auth/supabase"

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string; next?: string }
  | { status: "error"; message: string }

export type EmailCodeState = { status: "idle" } | { status: "error"; message: string }

/** Absolute origin for auth redirects. Supabase also checks it against its allow-list. */
async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  const h = await headers()
  const origin = h.get("origin")
  if (origin) return origin
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`
}

function callbackUrl(origin: string, next: string | undefined) {
  const url = new URL("/auth/callback", origin)
  if (next) url.searchParams.set("next", next)
  return url.toString()
}

export async function signInWithGithub(formData: FormData): Promise<void> {
  const next = formData.get("next")?.toString()
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: callbackUrl(await siteOrigin(), next) },
  })
  if (error || !data.url) redirect("/login?error=oauth")
  redirect(data.url)
}

const magicLinkSchema = z.object({
  email: z.email("Enter a valid email address"),
  next: z.string().optional(),
})

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = magicLinkSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") || undefined,
  })
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]!.message }

  // Only the owner's address is ever emailed, but the response is identical either way so
  // the form can't be used to discover which address is allowed.
  if (parsed.data.email.toLowerCase() === serverEnv().ADMIN_EMAIL) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl(await siteOrigin(), parsed.data.next),
      },
    })
    if (error?.status === 429) {
      return { status: "error", message: "Too many requests. Please wait a minute and try again." }
    }
  }
  return { status: "sent", email: parsed.data.email, next: parsed.data.next }
}

const emailCodeSchema = z.object({
  email: z.email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "Enter the code from the email"),
  next: z.string().optional(),
})

/**
 * Signs in with the one-time code from the sign-in email. Unlike the link, which opens in
 * the phone's browser, the code can be typed into an installed home-screen app, which keeps
 * its own cookies separate from the browser.
 */
export async function verifyEmailCode(
  _prev: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  const parsed = emailCodeSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    next: formData.get("next") || undefined,
  })
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]!.message }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  })
  if (error?.status === 429) {
    return { status: "error", message: "Too many attempts. Please wait a minute and try again." }
  }
  if (error || !data.user) {
    return { status: "error", message: "That code is invalid or has expired." }
  }

  const env = serverEnv()
  if (
    !isOwner(data.user, {
      adminEmail: env.ADMIN_EMAIL,
      adminGithubUsername: env.ADMIN_GITHUB_USERNAME,
    })
  ) {
    await supabase.auth.signOut()
    return { status: "error", message: "That account isn't allowed to use this app." }
  }
  redirect(safeRedirectPath(parsed.data.next))
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}
