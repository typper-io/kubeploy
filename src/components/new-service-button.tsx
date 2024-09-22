'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

export function NewServiceButton() {
  const path = usePathname()

  const showButton = useMemo(() => {
    const showButtons = ['/app']

    return showButtons.includes(path)
  }, [path])

  return (
    <>
      {showButton && (
        <Button asChild>
          <Link href="/app/new">New service</Link>
        </Button>
      )}
    </>
  )
}
