import React from 'react'
import { format } from 'date-fns'

export function LogViewer({ logs }: { logs: string }) {
  const parsedLogs = logs
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)

  const getColorForLevel = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-blue-500'
      case 'error':
        return 'text-destructive'
      case 'warn':
        return 'text-yellow-500'
      default:
        return 'text-gray-700'
    }
  }

  return (
    <div className="bg-accent rounded-md p-4 max-h-[800px] overflow-y-auto font-mono text-sm">
      {parsedLogs.map((log, index) => (
        <div key={index} className="mb-2">
          <span className="text-accent-foreground/50">
            {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
          </span>
          <span className={`ml-2 font-bold ${getColorForLevel(log.level)}`}>
            [{log.level.toUpperCase()}]
          </span>
          <span className="ml-2">{log.message}</span>
          {log.stack && (
            <pre className="mt-1 text-xs text-gray-600 overflow-x-auto">
              {log.stack}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
