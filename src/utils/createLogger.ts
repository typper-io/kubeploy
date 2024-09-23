import winston from 'winston'
import path from 'path'
import fs from 'fs'

export function createLogger(serviceName: string) {
  const logDir = path.join(process.cwd(), 'logs')

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir)
  }

  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}.log`),
      }),
    ],
  })
}
