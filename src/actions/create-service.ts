'use server'

import { prisma } from '@/prisma-client'
import { z } from 'zod'
import * as k8s from '@kubernetes/client-node'
import winston from 'winston'
import path from 'path'
import fs from 'fs'
import { getServerSession } from 'next-auth'
import authOptions from '@/app/api/auth/[...nextauth]/authOptions'
import { ServiceStatus } from '@prisma/client'

function createLogger(serviceName: string) {
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

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  domain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}$/),
  environmentVariables: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string().min(1),
    })
  ),
  repository: z.string().min(1),
})

export type CreateServiceData = z.infer<typeof formSchema>

async function waitForJobCompletion({
  jobName,
  namespace,
  interval = 10000,
  maxAttempts = 200,
  logger,
}: {
  jobName: string
  namespace: string
  maxAttempts?: number
  interval?: number
  logger: winston.Logger
}): Promise<boolean> {
  const kc = new k8s.KubeConfig()

  kc.loadFromDefault()

  const batchApi = kc.makeApiClient(k8s.BatchV1Api)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await batchApi.readNamespacedJobStatus(jobName, namespace)
    const job = response.body

    if (job.status?.succeeded === 1) {
      logger.info('Job completed successfully')

      return true
    }

    if (job.status?.failed === 1) {
      logger.error('Build job failed')

      throw new Error('Build job failed')
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  logger.error('Job did not complete within the allocated time')

  throw new Error('Job did not complete within the allocated time')
}

async function deleteResources({
  name,
  namespace,
  logger,
}: {
  name: string
  namespace: string
  logger: winston.Logger
}) {
  logger.info('Attempting to delete resources...')
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()

  const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api)
  const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api)
  const k8sCustomObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi)
  const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api)

  try {
    await Promise.all([
      k8sApi.deleteNamespacedConfigMap(`${name}-dockerfile`, namespace),
      k8sApi.deleteNamespacedConfigMap(`${name}-repo-content`, namespace),
      k8sApi.deleteNamespacedConfigMap(`${name}-env`, namespace),
      k8sBatchApi.deleteNamespacedJob(`${name}-build`, namespace),
      k8sAppsApi.deleteNamespacedDeployment(name, namespace),
      k8sApi.deleteNamespacedService(name, namespace),
      k8sCustomObjectsApi.deleteNamespacedCustomObject(
        'cert-manager.io',
        'v1',
        namespace,
        'issuers',
        `letsencrypt-${name}`
      ),
      k8sNetworkingApi.deleteNamespacedIngress(`ingress-${name}`, namespace),
      k8sApi.deleteNamespacedSecret('git-oauth-token', namespace),
    ])
    logger.info('Resources deleted successfully')
  } catch (error) {
    logger.error('Error deleting resources:', error)
  }
}

async function buildAndDeployToKubernetes({
  environmentVariables,
  name,
  namespace,
  domain,
  repository,
  accessToken,
  logger,
}: {
  name: string
  domain: string
  environmentVariables: Array<{ key: string; value: string }>
  namespace: string
  logger: winston.Logger
  repository: string
  accessToken: string
}) {
  logger.info('Starting buildAndDeployToKubernetes function')

  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()

  const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api)
  const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api)
  const k8sCustomObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi)
  const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api)

  try {
    logger.info('Determining install and build commands')

    const oauthSecret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'git-oauth-token',
        namespace: namespace,
      },
      type: 'Opaque',
      stringData: {
        token: accessToken,
      },
    }

    await k8sApi.createNamespacedSecret(namespace, oauthSecret)

    const dockerfileContent = `
    FROM node:lts
    WORKDIR /app
    COPY . .
    
    RUN if [ -f "pnpm-lock.yaml" ]; then \
          npm install -g pnpm && \
          pnpm install --force; \
        elif [ -f "yarn.lock" ]; then \
          npm install -g yarn && \
          yarn install --force; \
        elif [ -f "package-lock.json" ]; then \
          npm ci; \
        else \
          npm install; \
        fi
    
    RUN npm run build
    
    CMD if [ -f "pnpm-lock.yaml" ]; then \
          pnpm start; \
        elif [ -f "yarn.lock" ]; then \
          yarn start; \
        else \
          npm start; \
        fi
    `

    logger.info('Creating Kaniko build job')

    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const githubRegistryName = 'ghcr.io'
    const githubImageName = `${githubRegistryName}/${repository.toLocaleLowerCase()}:latest`

    const kanikoBuildJob = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: `${sanitizedName}-build`,
        namespace: namespace,
      },
      spec: {
        template: {
          spec: {
            initContainers: [
              {
                name: 'git-clone',
                image: 'alpine/git:v2.32.0',
                command: ['/bin/sh', '-c'],
                args: [
                  `git clone --depth 1 --single-branch --branch main https://oauth2:$\{OAUTH_TOKEN}@github.com/${repository}.git /workspace`,
                ],
                env: [
                  {
                    name: 'OAUTH_TOKEN',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'git-oauth-token',
                        key: 'token',
                      },
                    },
                  },
                ],
                volumeMounts: [
                  {
                    name: 'workspace',
                    mountPath: '/workspace',
                  },
                ],
                resources: {
                  requests: {
                    memory: '64Mi',
                    cpu: '100m',
                  },
                  limits: {
                    memory: '128Mi',
                    cpu: '200m',
                  },
                },
              },
              {
                name: 'create-dockerfile',
                image: 'busybox:1.35',
                command: ['/bin/sh', '-c'],
                args: [`echo "${dockerfileContent}" > /workspace/Dockerfile`],
                volumeMounts: [
                  {
                    name: 'workspace',
                    mountPath: '/workspace',
                  },
                ],
                resources: {
                  requests: {
                    memory: '32Mi',
                    cpu: '50m',
                  },
                  limits: {
                    memory: '64Mi',
                    cpu: '100m',
                  },
                },
              },
            ],
            containers: [
              {
                name: 'kaniko',
                image: 'gcr.io/kaniko-project/executor:v1.9.1',
                args: [
                  '--dockerfile=/workspace/Dockerfile',
                  '--context=/workspace',
                  `--destination=${githubImageName}`,
                  '--cache=true',
                  '--cache-ttl=24h',
                  '--snapshot-mode=redo',
                  '--use-new-run',
                  '--compressed-caching=false',
                  '--log-format=json',
                ],
                volumeMounts: [
                  {
                    name: 'workspace',
                    mountPath: '/workspace',
                  },
                  {
                    name: 'github-token',
                    mountPath: '/kaniko/.docker',
                  },
                ],
                resources: {
                  requests: {
                    memory: '1Gi',
                    cpu: '500m',
                  },
                  limits: {
                    memory: '2Gi',
                    cpu: '1',
                  },
                },
              },
            ],
            restartPolicy: 'Never',
            volumes: [
              {
                name: 'workspace',
                emptyDir: {},
              },
              {
                name: 'github-token',
                secret: {
                  secretName: 'github-container-registry-auth',
                  items: [
                    {
                      key: '.dockerconfigjson',
                      path: 'config.json',
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    await k8sBatchApi.createNamespacedJob(namespace, kanikoBuildJob)

    logger.info('Kaniko build job created successfully')

    logger.info('Waiting for job completion')

    await waitForJobCompletion({
      jobName: `${sanitizedName}-build`,
      namespace,
      logger,
    })

    logger.info('Creating environment variables ConfigMap')

    const envConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${name}-env`,
        namespace: namespace,
      },
      data: Object.fromEntries(
        environmentVariables.map(({ key, value }) => [key, value])
      ),
    }

    await k8sApi.createNamespacedConfigMap(namespace, envConfigMap)

    logger.info('Environment variables ConfigMap created successfully')

    logger.info('Creating deployment')

    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: name,
        namespace: namespace,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
            },
          },
          spec: {
            containers: [
              {
                name: name,
                image: githubImageName,
                imagePullPolicy: 'Always',
                envFrom: [
                  {
                    configMapRef: {
                      name: `${name}-env`,
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    }

    await k8sAppsApi.createNamespacedDeployment(namespace, deployment)

    logger.info('Deployment created successfully')

    logger.info('Creating service')

    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: name,
        namespace: namespace,
      },
      spec: {
        selector: {
          app: name,
        },
        ports: [
          {
            port: 80,
            targetPort: 3000,
          },
        ],
      },
    }

    await k8sApi.createNamespacedService(namespace, service)

    logger.info('Service created successfully')

    logger.info('Creating issuer')

    const issuer = {
      apiVersion: 'cert-manager.io/v1',
      kind: 'Issuer',
      metadata: {
        name: `letsencrypt-${name}`,
        namespace: namespace,
      },
      spec: {
        acme: {
          email: process.env.LETSENCRYPT_EMAIL,
          server: 'https://acme-v02.api.letsencrypt.org/directory',
          privateKeySecretRef: {
            name: `letsencrypt-${name}-private-key`,
          },
          solvers: [
            {
              http01: {
                ingress: {
                  class: 'nginx',
                },
              },
            },
          ],
        },
      },
    }

    await k8sCustomObjectsApi.createNamespacedCustomObject(
      'cert-manager.io',
      'v1',
      namespace,
      'issuers',
      issuer
    )

    logger.info('Issuer created successfully')

    logger.info('Creating ingress')

    const ingress = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: `ingress-${name}`,
        namespace: namespace,
        annotations: {
          'cert-manager.io/issuer': `letsencrypt-${name}`,
        },
      },
      spec: {
        tls: [
          {
            hosts: [domain],
            secretName: `letsencrypt-${name}`,
          },
        ],
        ingressClassName: 'nginx',
        rules: [
          {
            host: domain,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: `${name}-service`,
                      port: {
                        number: 3000,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    }

    await k8sNetworkingApi.createNamespacedIngress(namespace, ingress)

    k8sApi.deleteNamespacedSecret('git-oauth-token', namespace)

    logger.info('Ingress created successfully')

    logger.info('Deployment completed successfully')
  } catch (error) {
    logger.error('An error occurred during deployment:', error)

    logger.info('Attempting to clean up resources...')

    await deleteResources({ logger, name, namespace })

    throw error
  }
}

export async function createService(
  data: CreateServiceData
): Promise<{ name: string; description: string; id: string }> {
  const { domain, environmentVariables, name, repository } =
    formSchema.parse(data)

  const logger = createLogger(name)

  const foundService = await prisma.services.findFirst({
    where: {
      name,
    },
  })

  if (foundService) {
    logger.error('Service already exists')

    throw new Error('Service already exists')
  }

  const createdService = await prisma.services.create({
    data: {
      name,
      description: data.description,
      domain,
      status: ServiceStatus.PENDING,
    },
  })

  logger.info('Starting build and deploy process')

  const session = await getServerSession(authOptions)

  buildAndDeployToKubernetes({
    name,
    environmentVariables,
    namespace: process.env.DEFAULT_NAMESPACE!,
    domain,
    logger,
    repository,
    accessToken: session?.accessToken as string,
  })
    .catch(async () => {
      logger.error('Error building and deploying to Kubernetes...')

      await prisma.services.update({
        where: {
          id: createdService.id,
        },
        data: {
          status: ServiceStatus.ERROR,
        },
      })

      fs.unlink(path.join(process.cwd(), 'logs', `${name}.log`), (err) => {
        if (err) {
          logger.error('Error deleting log file:', err)
        }
      })
    })
    .then(async () => {
      const webhookUrl = `https://api.github.com/repos/${repository}/hooks`

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: new Headers({
          Authorization: `Bearer ${session?.accessToken}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: `https://${process.env.APP_DOMAIN}/api/github-webhook`,
            content_type: 'json',
          },
        }),
      })

      if (!response.ok) {
        logger.error('Error creating webhook')

        return
      }

      await prisma.services.update({
        where: {
          id: createdService.id,
        },
        data: {
          status: ServiceStatus.ACTIVE,
        },
      })

      logger.info('Webhook created successfully')
    })

  logger.info('Service created successfully')

  return {
    name: createdService.name,
    description: createdService.description,
    id: createdService.id,
  }
}
