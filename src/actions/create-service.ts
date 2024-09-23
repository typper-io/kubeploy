'use server'

import { prisma } from '@/prisma-client'
import { z } from 'zod'

import path from 'path'
import fs from 'fs'
import { getServerSession } from 'next-auth'
import authOptions from '@/app/api/auth/[...nextauth]/authOptions'
import { ServiceStatus } from '@prisma/client'
import { createLogger } from '@/utils/createLogger'
import { buildAndDeployToKubernetes } from '@/utils/kubernetes/buildAndDeployToKubernetes'

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  domain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}$/),
  environmentVariables: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string().min(1),
    })
  ),
  repository: z.string().min(1),
})

export type CreateServiceData = z.infer<typeof formSchema>

export async function createService(
  data: CreateServiceData
): Promise<{ name: string; description: string; id: string }> {
  const { domain, environmentVariables, name, repository } =
    formSchema.parse(data)

  const logger = createLogger(name)

  const foundService = await prisma.services.findFirst({
    where: {
      name,
    },
  })

  if (foundService) {
    logger.error('Service already exists')

    throw new Error('Service already exists')
  }

  const createdService = await prisma.services.create({
    data: {
      name,
      description: data.description,
      domain,
      status: ServiceStatus.PENDING,
      repository,
    },
  })

  logger.info('Starting build and deploy process')

  const session = await getServerSession(authOptions)

  buildAndDeployToKubernetes({
    name,
    environmentVariables,
    domain,
    logger,
    repository,
    firsDeploy: true,
  })
    .catch(async () => {
      logger.error('Error building and deploying to Kubernetes...')

      await prisma.services.update({
        where: {
          id: createdService.id,
        },
        data: {
          status: ServiceStatus.ERROR,
        },
      })

      fs.unlink(path.join(process.cwd(), 'logs', `${name}.log`), (err) => {
        if (err) {
          logger.error('Error deleting log file:', err)
        }
      })
    })
    .then(async () => {
      const webhookUrl = `https://api.github.com/repos/${repository}/hooks`

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: new Headers({
          Authorization: `Bearer ${session?.accessToken}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: `https://${process.env.APP_DOMAIN}/api/github-webhook`,
            content_type: 'json',
            secret: process.env.WEBHOOK_SECRET,
          },
        }),
      })

      if (!response.ok) {
        logger.error('Error creating webhook')

        return
      }

      await prisma.services.update({
        where: {
          id: createdService.id,
        },
        data: {
          status: ServiceStatus.ACTIVE,
        },
      })

      logger.info('Webhook created successfully')
    })

  logger.info('Service created successfully')

  return {
    name: createdService.name,
    description: createdService.description,
    id: createdService.id,
  }
}
