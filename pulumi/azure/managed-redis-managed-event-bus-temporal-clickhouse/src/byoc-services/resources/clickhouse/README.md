# ClickHouse Deployment

This module deploys ClickHouse using the local helm chart from `external/helm/clickhouse`.

## Current Configuration

- **Chart Source**: Local chart (`external/helm/clickhouse`)
- **Storage**: Azure managed disks (managed-csi storage class)
- **Keeper**: Enabled with 3 replicas for cluster coordination
- **Authentication**: Enabled with auto-generated password

## Azure Blob Storage (Optional)

ClickHouse supports Azure Blob Storage as an alternative to local persistent volumes. This is useful for:

- Separation of compute and storage
- Cost optimization (hot/cool storage tiers)
- Better scalability for large datasets

### Prerequisites

To enable Azure Blob Storage, you need to:

1. Create an Azure Storage Account
2. Create a container for ClickHouse data
3. Configure authentication (managed identity or connection string)

### Configuration Example

To enable Azure Blob Storage, uncomment and configure the storage settings in `index.ts`:

```typescript
// In the ClickhouseArgs interface, pass these values:
{
  azureStorageAccountName: "mystorageaccount",
  azureStorageContainerName: "clickhouse-data",
  azureStorageConnectionString: storageAccount.primaryConnectionString
}
```

Then uncomment the storage configuration in the helm values:

```typescript
defaultStoragePolicy: args.azureStorageAccountName ? "azure" : "default",
storageConfiguration: args.azureStorageAccountName ? {
  enabled: true,
  configTemplate: pulumi.interpolate`
    disks:
      azure_disk:
        type: object_storage
        object_storage_type: azure_blob_storage
        metadata_type: local
        storage_account_url: https://${args.azureStorageAccountName}.blob.core.windows.net/${args.azureStorageContainerName}/clickhouse/
        container_name: ${args.azureStorageContainerName}
        account_name: ${args.azureStorageAccountName}
        account_key: ${args.azureStorageConnectionString}
        metadata_path: /var/lib/clickhouse/disks/azure_disk/
      azure_cache:
        type: cache
        disk: azure_disk
        path: /var/lib/clickhouse/disks/azure_cache/
        max_size: 10Gi
    policies:
      azure:
        volumes:
          main:
            disk: azure_disk
  `
} : undefined
```

### Alternative: Managed Identity Authentication

For better security, you can use Azure Managed Identity instead of connection strings:

```typescript
clickhouse:
  serviceAccount:
    annotations:
      azure.workload.identity/client-id: "<managed-identity-client-id>"

  storageConfiguration:
    enabled: true
    configTemplate: |
      disks:
        azure_disk:
          type: object_storage
          object_storage_type: azure_blob_storage
          metadata_type: local
          storage_account_url: https://<account-name>.blob.core.windows.net/<container>/clickhouse/
          container_name: <container-name>
          account_name: <account-name>
          # Use workload identity instead of account_key
          use_workload_identity: true
          metadata_path: /var/lib/clickhouse/disks/azure_disk/
```

## Differences from Bitnami Chart

The new chart has a different values structure:

| Bitnami                | New Chart                       |
| ---------------------- | ------------------------------- |
| `shards`               | `clickhouse.shards`             |
| `replicaCount`         | `clickhouse.replicasPerShard`   |
| `persistence.*`        | `clickhouse.persistentVolume.*` |
| `keeper.persistence.*` | `keeper.persistentVolume.*`     |
| `auth.*`               | `clickhouse.auth.*`             |
| `service.ports.*`      | `ports.clickhouse.*`            |

## Service Access

The ClickHouse service is accessible within the cluster at:

- HTTP: `clickhouse.byoc-clickhouse.svc.cluster.local:8123`
- TCP (Native): `clickhouse.byoc-clickhouse.svc.cluster.local:9000`
- MySQL Protocol: `clickhouse.byoc-clickhouse.svc.cluster.local:9004`

Credentials are stored in the `sn-mds-clickhouse-config` secret in the `boreal-system` namespace.
