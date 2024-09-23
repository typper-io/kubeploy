import winston from 'winston'
import * as k8s from '@kubernetes/client-node'

export async function waitForJobCompletion({
  jobName,
  namespace,
  interval = 10000,
  maxAttempts = 200,
  logger,
}: {
  jobName: string
  namespace: string
  maxAttempts?: number
  interval?: number
  logger: winston.Logger
}): Promise<boolean> {
  const kc = new k8s.KubeConfig()

  kc.loadFromDefault()

  const batchApi = kc.makeApiClient(k8s.BatchV1Api)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await batchApi.readNamespacedJobStatus(jobName, namespace)
    const job = response.body

    if (job.status?.succeeded === 1) {
      logger.info('Job completed successfully')

      return true
    }

    if (job.status?.failed === 1) {
      logger.error('Build job failed')

      throw new Error('Build job failed')
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  logger.error('Job did not complete within the allocated time')

  throw new Error('Job did not complete within the allocated time')
}
