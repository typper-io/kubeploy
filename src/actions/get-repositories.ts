'use server'

import authOptions from '@/app/api/auth/[...nextauth]/authOptions'
import { getServerSession } from 'next-auth'

export async function getRepositories() {
  const session = await getServerSession(authOptions())

  if (!session || !session.accessToken) {
    throw new Error('Não autenticado')
  }

  const response = await fetch(
    'https://api.github.com/user/repos?per_page=100',
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error('Falha ao buscar repositórios')
  }

  const repositories = await response.json()

  return repositories.map((repository: any) => repository.full_name)
}
