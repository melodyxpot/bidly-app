"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ApplicationsTable } from "@/components/applications/applications-table"
import { ApplicationsHeader } from "@/components/applications/applications-header"
import { ApplicationDrawer } from "@/components/applications/application-drawer"
import { QuickPasteModal } from "@/components/applications/quick-paste-modal"
import { apiGetSettings } from "@/lib/api"
import type { Settings } from "@/lib/types"

export default function ApplicationsPage() {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    apiGetSettings().then(({ settings }) => setSettings(settings)).catch(() => {})
  }, [])

  const page = Number(searchParams.get("page")) || 1
  const search = searchParams.get("search") || ""
  const status = searchParams.get("status") || "all"
  const platform = searchParams.get("platform") || "all"
  const dateFrom = searchParams.get("dateFrom") || ""
  const dateTo = searchParams.get("dateTo") || ""
  const sortBy = searchParams.get("sortBy") || "appliedAt"
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc"
  const addOpen = searchParams.get("add") === "true"
  const editId = searchParams.get("edit") || undefined
  const quickpasteOpen = searchParams.get("quickpaste") === "true"

  return (
    <div className="flex flex-col gap-6 p-6">
      <ApplicationsHeader />
      <ApplicationsTable
        page={page}
        search={search}
        status={status}
        platform={platform}
        dateFrom={dateFrom}
        dateTo={dateTo}
        sortBy={sortBy}
        sortOrder={sortOrder}
        settings={settings}
      />
      <ApplicationDrawer open={addOpen || !!editId} editId={editId} settings={settings} />
      <QuickPasteModal open={quickpasteOpen} settings={settings} />
    </div>
  )
}
