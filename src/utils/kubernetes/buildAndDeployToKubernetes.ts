import winston from 'winston'
import * as k8s from '@kubernetes/client-node'
import { waitForJobCompletion } from '@/utils/kubernetes/waitForJobCompletion'
import { deleteResources } from '@/utils/kubernetes/deleteResources'
import { waitForDeploymentRollout } from '@/utils/kubernetes/waitForDeploymentRollout'
import { randomUUID } from 'crypto'

interface BuildAndDeployToKubernetesFirstDeploy {
  name: string
  domain: string
  environmentVariables: Array<{ key: string; value: string }>
  logger: winston.Logger
  repository: string
  firsDeploy: true
}

interface BuildAndDeployToKubernetesUpdate {
  name: string
  domain: string
  logger: winston.Logger
  repository: string
  firsDeploy: false
  environmentVariables?: Array<{ key: string; value: string }>
}

type BuildAndDeployToKubernetesOptions =
  | BuildAndDeployToKubernetesFirstDeploy
  | BuildAndDeployToKubernetesUpdate

export async function buildAndDeployToKubernetes({
  environmentVariables,
  name,
  domain,
  repository,
  logger,
  firsDeploy,
}: BuildAndDeployToKubernetesOptions) {
  const namespace = process.env.DEFAULT_NAMESPACE!

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
    const githubImageName = `${githubRegistryName}/${repository.toLocaleLowerCase()}:${randomUUID()}`

    const USERNAME = process.env.GITHUB_USERNAME
    const PASSWORD_OR_TOKEN = process.env.GITHUB_PASSWORD

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
                  `git clone --depth 1 --single-branch --branch main https://${USERNAME}:${PASSWORD_OR_TOKEN}@github.com/${repository}.git /workspace`,
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

    if (firsDeploy) {
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
              imagePullSecrets: [
                {
                  name: 'github-container-registry-auth',
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
          name: `${name}-service`,
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
    }

    if (!firsDeploy) {
      logger.info('Updating existing deployment')

      try {
        const existingDeployment = await k8sAppsApi.readNamespacedDeployment(
          name,
          namespace
        )

        if (
          existingDeployment.body &&
          existingDeployment.body.spec &&
          existingDeployment.body.spec.template &&
          existingDeployment.body.spec.template.spec &&
          existingDeployment.body.spec.template.spec.containers &&
          existingDeployment.body.spec.template.spec.containers.length > 0
        ) {
          existingDeployment.body.spec.template.spec.containers[0].image =
            githubImageName

          await k8sAppsApi.replaceNamespacedDeployment(
            name,
            namespace,
            existingDeployment.body
          )

          logger.info('Deployment updated successfully')

          await waitForDeploymentRollout(name, namespace, logger)

          logger.info('Rollout completed successfully')
        } else {
          throw new Error('Existing deployment structure is not as expected')
        }
      } catch (error) {
        logger.error('Error updating deployment:', error)
        throw error
      }
    }

    await k8sBatchApi.deleteNamespacedJob(`${sanitizedName}-build`, namespace)

    logger.info('Ingress created successfully')

    logger.info('Deployment completed successfully')
  } catch (error) {
    logger.error('An error occurred during deployment:', error)

    logger.info('Attempting to clean up resources...')

    await deleteResources({ logger, name, namespace, firsDeploy })

    throw error
  }
}
