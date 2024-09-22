'use server'

import { prisma } from '@/prisma-client'
import { Services } from '@prisma/client'

export async function getServices(): Promise<Array<Services>> {
  return prisma.services.findMany()
}
