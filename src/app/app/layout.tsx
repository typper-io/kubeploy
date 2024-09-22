import { Description } from '@/components/description'
import { Header } from '@/components/header'
import { NewServiceButton } from '@/components/new-service-button'
import { Title } from '@/components/title'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <Header />

      <div className="mx-auto container px-4 py-6 flex flex-col gap-10">
        <div className="flex w-full justify-between items-center">
          <div className="flex flex-col gap-1">
            <Title />
            <Description />
          </div>

          <NewServiceButton />
        </div>

        {children}
      </div>
    </>
  )
}
