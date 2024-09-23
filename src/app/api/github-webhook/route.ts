import { prisma } from '@/prisma-client'
import { createLogger } from '@/utils/createLogger'
import { buildAndDeployToKubernetes } from '@/utils/kubernetes/buildAndDeployToKubernetes'
import { verifySignature } from '@/utils/verifySignature'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET

  const rawBody = await req.text()

  if (secret && !(await verifySignature(req, secret, rawBody))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = req.headers.get('x-github-event')

  let payload = null

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (event === 'push') {
    const service = await prisma.services.findFirst({
      where: {
        repository: payload.repository.full_name,
      },
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const logger = createLogger(service.name)

    await buildAndDeployToKubernetes({
      name: service.name,
      domain: service.domain,
      firsDeploy: false,
      logger,
      repository: service.repository!,
    })
  }

  return NextResponse.json({ message: 'Webhook received' }, { status: 200 })
}
