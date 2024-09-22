'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { signIn } from 'next-auth/react'

export default function Login() {
  return (
    <div className="flex items-center justify-center h-dvh">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Login with your email using the admin allowed email.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() =>
              signIn('github', {
                callbackUrl: '/app',
              })
            }
          >
            SignIn with Github
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
