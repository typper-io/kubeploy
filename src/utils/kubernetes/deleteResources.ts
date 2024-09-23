import winston from 'winston'
import * as k8s from '@kubernetes/client-node'

export async function deleteResources({
  name,
  namespace,
  logger,
  firsDeploy,
}: {
  name: string
  namespace: string
  logger: winston.Logger
  firsDeploy: boolean
}) {
  logger.info('Attempting to delete resources...')

  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()

  const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api)
  const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api)
  const k8sCustomObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi)
  const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api)

  try {
    if (!firsDeploy) {
      k8sBatchApi.deleteNamespacedJob(`${name}-build`, namespace)

      return logger.info('Resources deleted successfully')
    }

    await Promise.all([
      k8sApi.deleteNamespacedConfigMap(`${name}-env`, namespace),
      k8sBatchApi.deleteNamespacedJob(`${name}-build`, namespace),
      k8sAppsApi.deleteNamespacedDeployment(name, namespace),
      k8sApi.deleteNamespacedService(`${name}-service`, namespace),
      k8sCustomObjectsApi.deleteNamespacedCustomObject(
        'cert-manager.io',
        'v1',
        namespace,
        'issuers',
        `letsencrypt-${name}`
      ),
      k8sNetworkingApi.deleteNamespacedIngress(`ingress-${name}`, namespace),
    ])
    logger.info('Resources deleted successfully')
  } catch (error) {
    logger.error('Error deleting resources:', error)
  }
}
