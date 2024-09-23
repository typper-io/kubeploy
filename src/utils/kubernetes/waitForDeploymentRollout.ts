import winston from 'winston'
import * as k8s from '@kubernetes/client-node'

export async function waitForDeploymentRollout(
  deploymentName: string,
  namespace: string,
  logger: winston.Logger,
  timeout = 300000
): Promise<void> {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()
  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api)

  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const response = await k8sAppsApi.readNamespacedDeployment(
        deploymentName,
        namespace
      )

      const deployment = response.body

      if (
        deployment.status?.updatedReplicas === deployment.spec?.replicas &&
        deployment.status?.replicas === deployment.spec?.replicas &&
        deployment.status?.availableReplicas === deployment.spec?.replicas
      ) {
        logger.info('Deployment rollout completed successfully')

        return
      }

      logger.info('Waiting for deployment rollout to complete...')

      await new Promise((resolve) => setTimeout(resolve, 5000))
    } catch (error) {
      logger.error('Error checking deployment status:', error)
      throw error
    }
  }

  throw new Error('Deployment rollout timed out')
}
