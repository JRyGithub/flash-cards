import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { Skeleton } from "@/components/atoms/skeleton"
import { LoginPanel } from "@/components/organisms/login-panel"
import { AuthLayout } from "@/components/templates/auth-layout"
import { getSessionStatus } from "@/server/auth/session"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <AuthLayout title="Flash Cards" description="Sign in to continue studying.">
      <Suspense fallback={<Skeleton className="h-48" />}>
        <RedirectIfSignedIn />
        <LoginPanel />
      </Suspense>
    </AuthLayout>
  )
}

/** The owner has no reason to see the login page. */
async function RedirectIfSignedIn() {
  const session = await getSessionStatus()
  if (session.status === "owner") redirect("/")
  return null
}
