# BYOC AWS Managed Services Deployment

Deploy AWS infrastructure with managed Redis (ElastiCache), managed Kafka (MSK), and self-hosted Temporal/ClickHouse on EKS.

## Prerequisites

### Quick Install

```bash
./install-prerequisites.sh
```

This installs: AWS CLI, Pulumi, Node.js, pnpm, and kubectl.

### Manual Setup

#### 1. Configure AWS Profile

**Option A: AWS SSO (Recommended for organizations)**

```bash
aws configure sso
```

You'll need: SSO start URL, SSO Region, Account ID, and Role

**Option B: AWS CLI Configuration**

```bash
aws configure --profile sandbox-admin
```

**Option C: Manual Credentials File**

```bash
# Create AWS credentials directory
mkdir -p ~/.aws

# Create credentials file
cat > ~/.aws/credentials <<EOF
[sandbox-admin]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
EOF

# Create config file
cat > ~/.aws/config <<EOF
[profile sandbox-admin]
region = us-east-2
output = json
EOF

# Set file permissions
chmod 600 ~/.aws/credentials
chmod 600 ~/.aws/config
```

#### 2. Login to Pulumi

```bash
# With access token (recommended for teams)
PULUMI_ACCESS_TOKEN=<your-token> pulumi login --cloud-url https://api.pulumi.com
```

## Deployment

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd boreal-byoc-examples
pnpm install
```

### 2. Set Up Org Configuration

Before deploying, set up your org configuration (see Configuration section above).

### 3. Deploy Infrastructure

Deploy all stacks using the launcher:

```bash
cd pulumi/aws/managed-redis-managed-kafka-temporal-clickhouse

# Deploy all stacks (uses 'mrm' org by default)
npm run deploy

# Or specify a different org
ORG=your-org-name npm run deploy

# Or use the launcher directly
npx tsx launcher.ts up --org your-org-name
```

The launcher will:

1. Copy `Pulumi.yaml` from `config/{org}/` to project root
2. Deploy stacks in order: base → byoc-services → datadog → mds
3. Use `--config-file` to reference org-specific stack configs
4. Clean up `Pulumi.yaml` after deployment

> **Note**: Stacks are automatically created if they don't exist. The launcher handles stack initialization.

## Stack Management

### Alternative Stack Initialization

If you prefer to create stacks with different names or use an existing backend:

```bash
# Create stack with custom name
pulumi stack init mycompany-base

# Or select an existing stack
pulumi stack select mycompany-base

# List available stacks
pulumi stack ls
```

### Skip Stack Selection Prompts

To avoid the interactive stack selection, you can specify the stack directly:

```bash
# Create and select stack in one command
pulumi stack init base && pulumi up

# Or run with specific stack
pulumi up --stack base
```

## Configuration

### Org-Based Configuration

This repository uses org-based configuration to keep customer-specific configs out of the public repo. Configs are stored in `config/{org}/` directories.

#### Setting Up a New Org

Use the automated script to create new org configs:

```bash
# Create new org configs
npm run create-config "Your Org Name" org_2qMFnk4YOm

# Or run directly
node create-config.js "Your Org Name" org_2qMFnk4YOm
```

**Arguments:**

- **Org Name**: The organization name (spaces will be converted to hyphens and lowercased)
- **Org ID**: The Boreal organization ID (mixed case format)

The script will:

- Create a new directory in `config/` based on the processed org name
- Copy all example config files from `config/_example/`
- Replace placeholders with your org-specific values

**After creating configs:**

1. Review the generated files in `config/{your-org-name}/`
2. Update `YOUR_AWS_PROFILE_HERE` in `Pulumi.yaml` with your AWS profile name
3. Update `YOUR_IMAGE_TAG_HERE` in `Pulumi.mds.yaml` with the appropriate MDS image tag

**Manual Setup (Alternative)**

If you prefer to set up configs manually:

1. Create your org config directory: `mkdir -p config/your-org-name`
2. Copy example configs: `cp -r config/_example/* config/your-org-name/`
3. Update `config/your-org-name/Pulumi.yaml` with your org-specific values
4. Update stack configs in `config/your-org-name/` as needed

#### Using Org Configs

Deploy with your org name:

```bash
# Using npm scripts (defaults to 'mrm' org)
npm run deploy

# Or override with environment variable
ORG=your-org-name npm run deploy

# Or directly with launcher
npx tsx launcher.ts up --org your-org-name
```

#### Configuration Files

All configuration files are in `config/{org}/`:

- **Pulumi.yaml**: Project-level config with org-specific project name
- **Pulumi.{stack}.yaml**: Stack-specific configs
- **AWS**: Profile and region
- **VPC**: CIDR block (default: 10.192.0.0/16)
- **EKS**: Cluster name and endpoints
- **Jump Box**: Enable/disable and instance type
- **Tailscale**: Auth key from ESC environment

> **Note**: The `config/` directory is excluded from git. Never commit actual customer configs to the repository.

### MDS Resource Config

For AWS BYOC, the MDS stack reads `resourceConfig` from `Pulumi.mds.yaml` and passes it into the Helm release. The mounted `branch-config.json` now contains both `projectIds` and `branchIds`:

- `projectIds`: project-scoped volume mounts that apply to every branch in that project
- `branchIds`: exact branch-scoped pod overrides, custom domains, and optional branch-specific mount overrides

Use this when you want all branches in a project to receive the same volume mounts during deploy:

```yaml
config:
  resourceConfig:
    projectIds:
      "00000000-0000-0000-0000-000000000000":
        volumeMounts:
          - name: practice-records1
            storageClassName: smb-practice-records1
            storage: 100Gi
            mountPath: /mnt/practice-records1
```

Use `branchIds` for exact branch-scoped pod overrides:

```yaml
config:
  resourceConfig:
    branchIds:
      my-org-my-project-main-12345:
        pod:
          cpu: 8
          memory: 16G
```

Before enabling a mount, make sure the storage backend already exists:

- Project-scoped mounts under `projectIds` should stay dynamically provisioned and therefore omit `volumeName`.
- Branch-scoped mounts under `branchIds` may still include `volumeName` when you intentionally want static binding to a specific PV.

Recommended rollout:

1. Update `config/{org}/Pulumi.mds.yaml` with the new `resourceConfig` entry.
2. Deploy the `mds` stack so the resource config reaches the live MDS ConfigMap.
3. Trigger a deploy for a matching branch.
4. Verify the PVC and mount in the branch namespace:

```bash
kubectl get pvc -A | grep <branch-or-mount-name>
kubectl describe pvc <pvc-name> -n <branch-namespace>
kubectl describe pod <moose-pod> -n <branch-namespace>
```

If you want to validate the storage class before wiring it into MDS, create a one-off test PVC first:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: smb-smoke-test
  namespace: default
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: smb-practice-records1
  resources:
    requests:
      storage: 100Gi
```

```bash
kubectl apply -f pvc.yaml
kubectl get pvc smb-smoke-test -n default -w
```

If the test PVC never reaches `Bound`, the issue is in cluster storage setup rather than MDS.

PodDisruptionBudget changes are orthogonal to this flow. New PDB handling does not change how project- or branch-scoped mounts are selected or created. The important rollout is the MDS image and chart version that understand the unified `resourceConfig` shape.

## Verify Deployment

```bash
# Update kubeconfig
aws eks update-kubeconfig --name boreal-byoc-eks-cluster --region us-east-2

# Check resources
kubectl get nodes
kubectl get pods -A
```

## Troubleshooting

### AWS SSO Login Issues

```bash
aws sso login --profile sandbox-admin
```

### Pulumi Errors

- Check AWS credentials: `aws sts get-caller-identity`
- Verify Pulumi login: `pulumi whoami`
- View detailed logs: `pulumi logs`

## Cleanup

Destroy all stacks using the launcher:

```bash
# Destroy all stacks (uses 'mrm' org by default)
npm run destroy:all

# Or specify a different org
ORG=your-org-name npm run destroy:all

# Or use the launcher directly
npx tsx launcher.ts destroy --org your-org-name
```

The launcher will destroy stacks in reverse order: mds → datadog → byoc-services → base
