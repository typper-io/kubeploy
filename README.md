# Kubeploy

Kubeploy is an open-source platform designed to simplify the deployment of Next.js applications on Kubernetes clusters with custom domains. It provides real-time metrics and logs, offering an experience similar to Vercel or Heroku but tailored for Kubernetes environments.

## Features

- **Easy Deployment**: Seamlessly deploy Next.js services with custom domains.
- **Metrics and Logs**: Monitor your applications with integrated metrics and logging.
- **Kubernetes Native**: Built specifically for Kubernetes, leveraging its full potential.
- **Open Source**: Free to use and modify under the MIT License.

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)

## Installation

Install Kubeploy using Helm with the following commands:

```bash
helm repo add kubeploy https://typper-io.github.io/kubeploy
helm repo update
helm upgrade kubeploy kubeploy/kubeploy \
  --values values.yaml \
  --create-namespace \
  --namespace kubeploy \
  --install
```

- **Prerequisites**:
  - Kubernetes cluster (v1.20 or higher recommended)
  - Helm installed on your local machine
  - Access to deploy resources in your Kubernetes cluster

## Getting Started

### Accessing the Dashboard

After installation, access the Kubeploy dashboard to manage your applications:

1. Forward the service port to your local machine (if necessary):

   ```bash
   kubectl port-forward svc/kubeploy-service -n kubeploy 3000:80
   ```

2. Open your web browser and navigate to `http://localhost:3000`.

### Deploying a Next.js Application

1. **Create a New Service**:

   - Click on **"New Service"** in the dashboard.
   - Enter your project's name and select the repository.

2. **Configure Deployment Settings**:

   - Set your custom domain.
   - Configure environment variables as needed.

3. **Deploy**:
   - Click **"Deploy"** to start the deployment process.
   - Monitor the deployment status in real-time.

### Monitoring Metrics and Logs

- **Metrics**:
  - Access the **"Metrics"** tab to view real-time performance data.
- **Logs**:
  - View application logs under the **"Logs"** section for troubleshooting.

## Configuration

Customize Kubeploy by editing the `values.yaml` file before installation.

### Example `values.yaml`

```yaml
namespace: kubeploy

serviceAccount:
  name: kubeploy-sa

clusterRole:
  name: kubeploy-role

clusterRoleBinding:
  name: kubeploy-role-binding

persistentVolumeClaim:
  name: postgres-data
  storage: 1Gi

kubeploy:
  image:
    repository: ghcr.io/typper-io/kubeploy
    tag: latest
    pullPolicy: Always
  replicas: 1
  githubContainerRegistry:
    enabled: true
    secretName: github-container-registry-auth
    username: 'your-github-username'
    # You should use a personal access token instead of your password with the following permissions:
    # - read:packages
    # - write:packages
    # - delete:packages
    password: 'your-github-personal-access-token'

  env:
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/kubeploy'

    # Used for github oauth
    GITHUB_SECRET: 'your-github-secret'
    GITHUB_ID: 'your-github-id'

    # Used for next-auth
    NEXTAUTH_SECRET: 'your-next-auth-secret'
    NEXTAUTH_URL: 'http://localhost:3000'

    INSTANCE_ADMIN_EMAIL: 'your-email'
    LETSENCRYPT_EMAIL: 'your-email'
    DEFAULT_NAMESPACE: 'kubeploy'
    NODE_ENV: 'development'

    # Used for github webhook
    APP_DOMAIN: 'localhost'

postgres:
  image:
    repository: postgres
    tag: '13'
  env:
    POSTGRES_DB: kubeploy
    POSTGRES_USER: postgres # You should change this
    POSTGRES_PASSWORD: password

service:
  name: kubeploy-service
  port: 80
  targetPort: 3000

certManager:
  enabled: true

ingressNginx:
  enabled: true
```

## Screenshots

TDB

## Contributing

We welcome contributions from the community!

- **Report Issues**: Use the issue tracker to report bugs or request features.
- **Pull Requests**: Submit pull requests for fixes or new features.
- **Feedback**: Share your feedback to improve Kubeploy.
