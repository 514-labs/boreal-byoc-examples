# BYOC Services Resources

This directory contains Pulumi modules for deploying various services in the BYOC (Bring Your Own Cloud) environment.

## Directory Structure

```
resources/
├── clickhouse-operator.ts  # Altinity ClickHouse Operator (cluster-scoped)
├── clickhouse-db/          # ClickHouse database clusters
├── kafka.ts                # Amazon MSK (Managed Streaming for Kafka)
├── redis.ts                # Amazon ElastiCache Redis
└── temporal.ts             # Temporal workflow engine
```

## Services

### ClickHouse

ClickHouse deployment is split into two modules:

#### 1. ClickHouse Operator (`clickhouse-operator.ts`)

Installs the Altinity ClickHouse Operator, a cluster-scoped operator that manages ClickHouse clusters via `ClickHouseInstallation` CRDs.

**Deploy first** - Required for ClickHouse database deployments.

```typescript
import { installClickhouseOperator } from "./clickhouse-operator";

const operator = installClickhouseOperator({
  namespace: "clickhouse-operator",
  releaseOpts: releaseOpts,
});
```

#### 2. [ClickHouse Database](./clickhouse-db/)

Deploys ClickHouse database clusters with optional S3 storage integration.

**Deploy after operator** - Creates actual ClickHouse clusters.

```typescript
import { deployClickhouseDatabase } from "./clickhouse-db";

const clickhouse = await deployClickhouseDatabase({
  clickhouseShards: 2,
  clickhouseReplicas: 3,
  clickhouseStorageSize: "100Gi",
  requestedMemory: "8Gi",
  requestedCpu: "4000m",
  releaseOpts: {
    ...releaseOpts,
    dependsOn: [operator.helmRelease],
  },
  tags: commonTags,
});
```

### Kafka

Amazon MSK (Managed Streaming for Apache Kafka) cluster with configurable broker nodes and storage.

```typescript
import { createMSKCluster } from "./kafka";

const kafka = await createMSKCluster({
  vpcId: vpc.id,
  privateSubnetIds: privateSubnets.map((s) => s.id),
  // ... other config
});
```

### Redis

Amazon ElastiCache Redis cluster with replication and automatic failover.

```typescript
import { createElastiCacheRedis } from "./redis";

const redis = createElastiCacheRedis({
  vpcId: vpc.id,
  privateSubnetIds: privateSubnets.map((s) => s.id),
  // ... other config
});
```

### Temporal

Temporal workflow engine with Cassandra and Elasticsearch backends.

```typescript
import { installTemporal } from "./temporal";

await installTemporal({
  serverReplicas: 3,
  cassandraReplicas: 3,
  elasticsearchReplicas: 3,
  releaseOpts: releaseOpts,
});
```

## Deployment Order

Services should be deployed in this order due to dependencies:

1. **Redis** - No dependencies
2. **Kafka** - No dependencies
3. **Temporal** - No dependencies
4. **ClickHouse Operator** - No dependencies (cluster-scoped)
5. **ClickHouse Database** - Depends on ClickHouse Operator

The main deployment script (`../index.ts`) handles this ordering automatically.

## Common Patterns

### Resource Options

All modules accept `releaseOpts` for Pulumi resource options:

```typescript
const releaseOpts: pulumi.CustomResourceOptions = {
  provider: k8sProvider,
  dependsOn: [
    /* dependencies */
  ],
};
```

### Tags

AWS resources accept `tags` for resource tagging:

```typescript
const commonTags = {
  Cloud: "aws",
  Environment: "prod",
  Project: projectName,
  Stack: stackName,
  OrgId: orgId,
};
```

### S3 Integration (ClickHouse)

ClickHouse supports S3 storage with IAM roles (IRSA):

```typescript
s3Config: {
  bucketName: "my-clickhouse-data",
  region: "us-east-2",
  useIAMRole: true,
  cacheSizeGB: 20,
},
eksClusterInfo: {
  clusterName: eksClusterName,
  oidcProviderArn: eksOidcProviderArn,
},
```

## Development

### Adding New Services

1. Create a new module file (e.g., `new-service.ts`)
2. Export deployment functions
3. Import and call from `../index.ts`
4. Update this README

### Testing

Run linter on modified files:

```bash
npm run lint
```

### Documentation

Each service module should include:

- JSDoc comments on exported functions
- README.md with usage examples
- Configuration options documentation

## Resources

- [Pulumi Kubernetes Provider](https://www.pulumi.com/registry/packages/kubernetes/)
- [Pulumi AWS Provider](https://www.pulumi.com/registry/packages/aws/)
- [Altinity ClickHouse Operator](https://github.com/Altinity/clickhouse-operator)
- [Temporal Documentation](https://docs.temporal.io/)
