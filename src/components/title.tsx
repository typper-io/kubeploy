'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

export function Title() {
  const path = usePathname()
  const query = useSearchParams()

  const title = useMemo(() => {
    const titles: Record<string, string> = {
      '/app/settings': 'Settings',
      '/app/new': 'New Service',
      '/app': 'Services',
    }

    if (query.has('title')) {
      return query.get('title')!
    }

    return titles[path]
  }, [path, query])

  return (
    <>
      {!title ? (
        <Skeleton className="w-[100px] h-8" />
      ) : (
        <h1 className="text-3xl font-semibold">{title}</h1>
      )}
    </>
  )
}
