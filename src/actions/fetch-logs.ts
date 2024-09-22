'use server'

import * as k8s from '@kubernetes/client-node'
import fs from 'fs/promises'
import path from 'path'

function objectToQueryString(obj: Record<string, string> | undefined): string {
  if (!obj) return ''
  return Object.entries(obj)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join(',')
}

export async function getServiceLogs(serviceName: string): Promise<string> {
  try {
    const namespace = process.env.DEFAULT_NAMESPACE!
    const deploymentName = serviceName

    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()

    const appsV1Api = kc.makeApiClient(k8s.AppsV1Api)
    const coreV1Api = kc.makeApiClient(k8s.CoreV1Api)

    let k8sLogs = ''
    let k8sBuildLogs = ''

    try {
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

      const response = await coreV1Api.readNamespacedPodLog(
        podName,
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1000
      )

      k8sLogs = response.body
    } catch {
      k8sLogs = ''
    }

    try {
      const batchV1Api = kc.makeApiClient(k8s.BatchV1Api)
      const jobName = `${deploymentName}-build`
      const jobResponse = await batchV1Api.readNamespacedJob(jobName, namespace)

      const labelSelector = Object.entries(
        jobResponse.body.spec?.selector?.matchLabels || {}
      )
        .map(([key, value]) => `${key}=${value}`)
        .join(',')

      const podResponse = await coreV1Api.listNamespacedPod(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      )

      if (podResponse.body.items.length) {
        const podName = podResponse.body.items[0].metadata!.name!

        const logsResponse = await coreV1Api.readNamespacedPodLog(
          podName,
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          1000
        )

        k8sBuildLogs = logsResponse.body
      }
    } catch {
      k8sBuildLogs = 'Error fetching build logs'
    }

    const sanitizedServiceName = serviceName.replace(/[^a-zA-Z0-9-_]/g, '')

    const logFilePath = path.join(
      process.cwd(),
      'logs',
      `${sanitizedServiceName}.log`
    )

    let fileLogs = ''

    try {
      await fs.access(logFilePath)
      const logContent = await fs.readFile(logFilePath, 'utf-8')
      const lines = logContent.split('\n')
      fileLogs = lines.slice(-500).join('\n')
    } catch {
      fileLogs = 'No file logs found'
    }

    return fileLogs + k8sBuildLogs + k8sLogs
  } catch (error: any) {
    return `Error reading logs for service: ${serviceName}. ${error.message}`
  }
}
