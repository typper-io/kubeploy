'use server'

import * as k8s from '@kubernetes/client-node'

interface MetricDataPoint {
  timestamp: string
  cpu: number
  memory: number
}

function objectToQueryString(obj: Record<string, string> | undefined): string {
  if (!obj) return ''
  return Object.entries(obj)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join(',')
}

export async function getPodMetrics(name: string, duration: number = 6) {
  const namespace = process.env.DEFAULT_NAMESPACE!
  const deploymentName = name

  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()

  const appsV1Api = kc.makeApiClient(k8s.AppsV1Api)
  const coreV1Api = kc.makeApiClient(k8s.CoreV1Api)
  const metricsApi = kc.makeApiClient(k8s.CustomObjectsApi)

  const deployment = await appsV1Api.readNamespacedDeployment(
    deploymentName,
    namespace
  )
  const labelSelector = objectToQueryString(
    deployment.body.spec?.selector?.matchLabels
  )

  if (!labelSelector) {
    throw new Error('No label selector found for the given deployment')
  }

  const podList = await coreV1Api.listNamespacedPod(
    namespace,
    undefined,
    undefined,
    undefined,
    labelSelector
  )

  if (podList.body.items.length === 0) {
    throw new Error('No pods found for the given deployment')
  }

  const podName = podList.body.items[0].metadata!.name!

  const metricsData: MetricDataPoint[] = []
  const now = new Date()
  for (let i = 0; i < duration; i++) {
    const metrics = (await metricsApi.getNamespacedCustomObject(
      'metrics.k8s.io',
      'v1beta1',
      namespace,
      'pods',
      podName
    )) as any

    const podMetrics = metrics.body
    const cpuUsage = parseInt(podMetrics.containers[0].usage.cpu)
    const memoryUsage = parseInt(podMetrics.containers[0].usage.memory)

    metricsData.push({
      timestamp: new Date(now.getTime() - i * 60000).toISOString(),
      cpu: cpuUsage,
      memory: memoryUsage,
    })

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const formattedData = metricsData.reverse().map((metric) => ({
    timestamp: new Date(metric.timestamp).toLocaleTimeString(),
    cpu: metric.cpu,
    memory: Math.round(metric.memory / (1024 * 1024)),
  }))

  return formattedData
}
