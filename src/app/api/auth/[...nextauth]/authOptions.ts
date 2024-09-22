import { AuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'

const authOptions = (): AuthOptions => {
  const isDev = process.env.NODE_ENV === 'development'
  const domain = isDev ? 'localhost' : '' // TODO add domain

  return {
    providers: [
      GitHubProvider({
        clientId: process.env.GITHUB_ID!,
        clientSecret: process.env.GITHUB_SECRET!,
        authorization: {
          params: {
            scope: 'read:user user:email repo',
            allow_signup: 'false',
            prompt: 'consent',
          },
        },
      }),
    ],
    pages: {
      signIn: '/',
      error: '/',
      verifyRequest: '/',
    },
    callbacks: {
      async signIn({ user }) {
        return user.email === process.env.INSTANCE_ADMIN_EMAIL
      },
      async jwt({ token, account }) {
        if (account) {
          token.accessToken = account.access_token
        }
        return token
      },
      async session({ session, token }) {
        session.accessToken = token.accessToken as string
        return session
      },
    },
    secret: process.env.NEXTAUTH_SECRET,
    cookies: {
      ...(!isDev && {
        sessionToken: {
          name: '__Secure-next-auth.session-token',
          options: {
            httpOnly: true,
            sameSite: 'none',
            path: '/',
            domain,
            secure: true,
          },
        },
      }),
    },
  }
}

export default authOptions
