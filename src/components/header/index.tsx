import { AvatarDropdown } from '@/components/header/avatar-dropdown'
import Image from 'next/image'
import Link from 'next/link'

export function Header() {
  return (
    <div className="w-full border-b-border border-b">
      <div className="w-full p-4 mx-auto container flex items-center justify-between">
        <Link href="/app">
          <Image src="/k8s.svg" width={40} height={40} alt="Kubernetes Logo" />
        </Link>

        <AvatarDropdown />
      </div>
    </div>
  )
}
