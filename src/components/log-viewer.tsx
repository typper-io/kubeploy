import React from 'react'
import { format } from 'date-fns'

export function LogViewer({ logs }: { logs: string }) {
  const isObject = (data: string | Record<string, any>) => {
    try {
      JSON.stringify(data)

      return true
    } catch {
      return false
    }
  }

  const parsedLogs = logs
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return line
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
            {format(
              new Date(log?.timestamp || new Date()),
              'yyyy-MM-dd HH:mm:ss'
            )}
          </span>
          <span className={`ml-2 font-bold ${getColorForLevel(log.level)}`}>
            [{log?.level?.toUpperCase() || 'LOG'}]
          </span>
          <span className="ml-2">{log.message || log.msg}</span>
          {log.stack && (
            <pre className="mt-1 text-xs text-accent-foreground/20 overflow-x-auto">
              {log.stack}
            </pre>
          )}

          {!isObject(log) && (
            <pre className="mt-1 text-xs text-accent-foreground/20 overflow-x-auto">
              {log}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
