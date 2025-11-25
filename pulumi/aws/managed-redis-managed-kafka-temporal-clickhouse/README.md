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
