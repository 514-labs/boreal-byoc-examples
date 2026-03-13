# BYOC Azure Managed Services Deployment

Deploy Azure infrastructure with managed Redis, managed Event Hubs, and self-hosted Temporal/ClickHouse on AKS.

## Prerequisites

### 1. Configure Azure CLI

```bash
az login
az account set --subscription <your-subscription-id>
```

### 2. Login to Pulumi

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

Before deploying, set up your org configuration (see Configuration section below).

### 3. Deploy Infrastructure

Deploy all stacks using the launcher:

```bash
cd pulumi/azure/managed-redis-managed-event-bus-temporal-clickhouse

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

## Configuration

### Org-Based Configuration

This repository uses org-based configuration to keep customer-specific configs out of the public repo. Configs are stored in `config/{org}/` directories.

#### Setting Up a New Org

1. **Create your org config directory:**

   ```bash
   mkdir -p config/your-org-name
   ```

2. **Copy example configs:**

   ```bash
   cp -r config/_example/* config/your-org-name/
   ```

3. **Update `config/your-org-name/Pulumi.yaml`:**
   - Set the project `name` to your org-specific name (e.g., `boreal-cust-byoc-{your-org-id}`)
   - Update `orgId` and other org-specific values
   - Update `environment` ESC reference if needed

4. **Update stack configs in `config/your-org-name/`:**
   - `Pulumi.base.yaml` - Base infrastructure config (AKS, VNet)
   - `Pulumi.byoc-services.yaml` - BYOC services config
   - `Pulumi.datadog.yaml` - Datadog config
   - `Pulumi.mds.yaml` - MDS config

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
- **Azure**: Location and subscription settings
- **AKS**: Cluster configuration, node sizes, networking
- **VNet**: CIDR blocks and subnet configuration
- **Jump Box**: Enable/disable and instance type

> **Note**: The `config/` directory is excluded from git. Never commit actual customer configs to the repository.

## Verify Deployment

```bash
# Update kubeconfig
az aks get-credentials --resource-group <resource-group> --name <aks-cluster-name>

# Check resources
kubectl get nodes
kubectl get pods -A
```

## Troubleshooting

### Azure Authentication Issues

```bash
az account show
az account list
```

### Pulumi Errors

- Check Azure credentials: `az account show`
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
