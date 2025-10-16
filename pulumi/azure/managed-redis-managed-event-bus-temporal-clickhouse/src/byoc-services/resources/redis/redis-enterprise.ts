import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as azure from "@pulumi/azure-native";
/**
 * Azure Managed Redis (Redis Enterprise)
 *
 * High-performance Redis service built on Redis Enterprise.
 *
 * Key Features:
 * - Redis Enterprise (multi-threaded architecture)
 * - Up to 15x higher performance vs Azure Cache for Redis
 * - Up to 99.999% availability with Active-Active geo-replication
 * - Redis 7.4+ with latest features
 * - Advanced modules: RediSearch, RedisJSON, RedisBloom, RedisTimeSeries
 * - Independent scaling of memory and compute
 * - Good for: High-traffic production, mission-critical workloads
 *
 * Cost: ~$560-$8,000/mo depending on SKU
 *
 * Connection:
 * - Port: 10000 (TLS)
 * - Protocol: Standard Redis (RESP/RESP3) with OSS Cluster mode
 */

export interface RedisEnterpriseArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  k8sProvider: k8s.Provider;
  commonTags: { [k: string]: string };
  redisName?: string;
  skuName?: string; // "Enterprise" or "EnterpriseFlash"
  capacity?: number; // Enterprise: 2/4/6/10, EnterpriseFlash: 300/700/1500
  enableModules?: string[]; // e.g., ["RediSearch", "RedisJSON", "RedisBloom", "RedisTimeSeries"]
  evictionPolicy?: string; // Default: "allkeys-lru"
}

export async function createRedisEnterprise(args: RedisEnterpriseArgs) {
  const name = args.redisName ?? "boreal-byoc-redis";
  const evictionPolicy = args.evictionPolicy ?? "allkeys-lru";

  // Construct full SKU name from separate components
  const tier = args.skuName ?? "Enterprise";
  const size = args.capacity ?? 10;
  const prefix = tier === "EnterpriseFlash" ? "F" : "E";
  const fullSkuName = `${tier}_${prefix}${size}`;

  // Azure Managed Redis Enterprise Cluster
  const redisCluster = new azure.redisenterprise.RedisEnterprise("redis-enterprise-cluster", {
    clusterName: name,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    sku: {
      name: fullSkuName,
    },
    minimumTlsVersion: "1.2",
    zones: ["1", "2", "3"], // Zone redundancy for high availability
    tags: args.commonTags,
  });

  // Redis Enterprise Database within the cluster
  const redisDatabase = new azure.redisenterprise.Database("redis-enterprise-database", {
    databaseName: "default",
    clusterName: redisCluster.name,
    resourceGroupName: args.resourceGroupName,
    clientProtocol: "Encrypted", // Use TLS
    clusteringPolicy: "OSSCluster", // OSS Cluster mode for compatibility
    evictionPolicy: evictionPolicy,
    // Enable Redis modules if specified
    modules: args.enableModules?.map((moduleName) => ({
      name: moduleName,
    })),
  });

  // Connection details
  const host = redisCluster.hostName;
  const port = pulumi.output(10000); // Default port for Redis Enterprise

  // Retrieve the primary access key using listDatabaseKeys
  const keys = azure.redisenterprise.listDatabaseKeysOutput({
    clusterName: redisCluster.name,
    databaseName: redisDatabase.name,
    resourceGroupName: args.resourceGroupName,
  });
  const password = keys.primaryKey;

  // Create Kubernetes secret with Redis configuration
  const secret = new k8s.core.v1.Secret(
    "sn-moose-cache-redis-config",
    {
      metadata: {
        name: "sn-moose-cache-redis-config",
        namespace: "boreal-system",
      },
      stringData: {
        host: host,
        port: port.apply(String),
        password: password,
        url: pulumi.interpolate`rediss://default:${password}@${host}:${port}`,
        ssl: "true",
      },
    },
    { provider: args.k8sProvider }
  );

  return {
    cluster: redisCluster,
    database: redisDatabase,
    secret: secret,
    serviceType: "managed" as const,
  };
}
