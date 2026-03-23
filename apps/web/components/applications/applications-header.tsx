"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, ClipboardPaste } from "lucide-react"

export function ApplicationsHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground">Manage and track all your job applications</p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/applications?add=true">
            <Plus className="mr-2 h-4 w-4" />
            Add Application
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/applications?quickpaste=true">
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Quick Paste
          </Link>
        </Button>
      </div>
    </div>
  )
}
