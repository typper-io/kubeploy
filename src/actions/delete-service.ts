'use server'

import { prisma } from '@/prisma-client'

export async function deleteService(id: string): Promise<void> {
  await prisma.services.delete({
    where: {
      id,
    },
  })
}
