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

### 2. Deploy Infrastructure

Deploy the three stacks in order:

#### Base Stack (VPC, EKS, Networking)
```bash
cd pulumi/aws/managed-redis-managed-kafka-temporal-clickhouse/base
pulumi install

# Initialize the stack (first time only)
pulumi stack init base

# Deploy the infrastructure
pulumi up
```

> **Note**: When running `pulumi up` for the first time, you'll be prompted to select a stack. Choose "create a new stack" and name it `base`. This only needs to be done once per stack.

#### BYOC Services Stack (Redis, Kafka, Temporal, ClickHouse)
```bash
cd ../byoc-services

# Initialize the stack (first time only)
pulumi stack init byoc-services

# Deploy the services
pulumi up
```

#### MDS Stack (Moose Deployment Service)
```bash
cd ../mds

# Initialize the stack (first time only)
pulumi stack init mds

# Deploy MDS
pulumi up
```

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

All configuration is in `base/Pulumi.base.yaml`. Key settings:
- **AWS**: Profile and region
- **VPC**: CIDR block (default: 10.192.0.0/16)
- **EKS**: Cluster name and endpoints
- **Jump Box**: Enable/disable and instance type
- **Tailscale**: Auth key from ESC environment

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

Destroy resources in reverse order:
```bash
cd mds && pulumi destroy --stack mds
cd ../byoc-services && pulumi destroy --stack byoc-services
cd ../base && pulumi destroy --stack base

# Optional: Remove the stacks completely
pulumi stack rm mds
pulumi stack rm byoc-services  
pulumi stack rm base
```