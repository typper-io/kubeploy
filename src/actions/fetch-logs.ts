'use server'

import fs from 'fs/promises'
import path from 'path'

export async function getServiceLogs(serviceName: string): Promise<string> {
  try {
    const sanitizedServiceName = serviceName.replace(/[^a-zA-Z0-9-_]/g, '')

    const logFilePath = path.join(
      process.cwd(),
      'logs',
      `${sanitizedServiceName}.log`
    )

    await fs.access(logFilePath)

    const logContent = await fs.readFile(logFilePath, 'utf-8')

    const lines = logContent.split('\n')
    const lastLines = lines.slice(-1000).join('\n')

    return lastLines
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return `No logs found for service: ${serviceName}`
    }

    return `Error reading logs for service: ${serviceName}`
  }
}
