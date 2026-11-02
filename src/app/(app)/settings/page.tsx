import type { Metadata } from "next"
import { Suspense } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card"
import { Skeleton } from "@/components/atoms/skeleton"
import { PageHeader } from "@/components/molecules/page-header"
import { BackupPanel } from "@/components/organisms/backup-panel"
import { SettingsForm } from "@/components/organisms/settings-form"
import { getSettings } from "@/server/queries"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" />
      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
          <CardDescription>
            Cards are scheduled with FSRS, the algorithm modern Anki uses, with Anki-style learning
            steps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-72" />}>
            <SchedulingSettings />
          </Suspense>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Backup</CardTitle>
          <CardDescription>
            Keep a copy of your cards and progress outside the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupPanel />
        </CardContent>
      </Card>
    </div>
  )
}

async function SchedulingSettings() {
  const { fsrsWeights: _weights, ...settings } = await getSettings()
  return <SettingsForm initial={settings} />
}
