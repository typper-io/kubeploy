'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

export function Description() {
  const path = usePathname()
  const query = useSearchParams()

  const description = useMemo(() => {
    const descriptions: Record<string, string> = {
      '/app/settings': 'Manage your account settings',
      '/app/new': 'Create a new service',
      '/app': 'See your services',
    }

    if (query.has('description')) {
      return query.get('description')!
    }

    return descriptions[path]
  }, [path, query])

  return (
    <>
      {!description ? (
        <Skeleton className="w-[200px] h-8" />
      ) : (
        <p className="text-base text-foreground/50">{description}</p>
      )}
    </>
  )
}
