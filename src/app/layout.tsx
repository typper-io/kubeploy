import './globals.css'
import { Sora } from 'next/font/google'
import { Providers } from '@/components/providers'
import { getServerSession } from 'next-auth'
import authOptions from '@/app/api/auth/[...nextauth]/authOptions'

const fontSora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <body
        className={`${fontSora.variable} bg-background text-foreground min-h-dvh`}
      >
        <Providers
          session={session}
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          forcedTheme="dark"
        >
          {children}
        </Providers>
      </body>
    </html>
  )
}
