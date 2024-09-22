'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes/dist/types'
import { SessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'
import { Toaster } from '@/components/ui/toaster'

export function Providers({
  children,
  session,
  ...props
}: ThemeProviderProps & {
  session?: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
      <Toaster />
    </SessionProvider>
  )
}
