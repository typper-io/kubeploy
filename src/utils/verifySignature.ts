import crypto from 'crypto'
import { NextRequest } from 'next/server'

export async function verifySignature(
  req: NextRequest,
  secret: string,
  rawBody: string
): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256')
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(rawBody)
  const digest = `sha256=${hmac.digest('hex')}`
  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(digest)
  )
}
