import { getServices } from '@/actions/get-services'
import { Globe } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function Home() {
  const services = await getServices()

  return (
    <div className="flex flex-wrap gap-5">
      {services.map((service) => (
        <Link
          href={`/app/service/${service.id}?title=${service.name}&description=${service.description}`}
          key={service.name}
          className="flex p-4 rounded-md border border-border min-h-40 min-w-[400px] flex-grow cursor-pointer hover:bg-accent"
        >
          <div className="flex flex-col justify-between w-full">
            <div className="flex flex-col gap-0.5">
              <div className="flex gap-1 items-center">
                <Globe size={14} />
                <h2 className="text-lg truncate">{service.name}</h2>
              </div>

              <p className="text-sm text-foreground/50 truncate">
                {service.description}
              </p>
            </div>

            <p className="text-foreground/50 text-sm">
              Created {format(new Date(service.createdAt), 'MMMM dd, yyyy')}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
