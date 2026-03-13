import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as redis from "@pulumi/azure-native/redis";

/**
 * Azure Cache for Redis (Community Edition)
 *
 * Cost-effective Redis service built on open-source Redis.
 *
 * Key Features:
 * - Standard Redis (community edition, single-threaded)
 * - Lower cost: ~$40-$400/mo for typical workloads
 * - Basic, Standard, and Premium tiers available
 * - Good for: POCs, development, testing, low-traffic production
 *
 * Note: Microsoft is retiring this service and recommends migrating to Azure Managed Redis.
 * However, it remains a cost-effective option for POCs and development.
 *
 * Connection:
 * - Port: 6380 (TLS)
 * - Protocol: Standard Redis (RESP)
 */

export interface RedisCacheArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  k8sProvider: k8s.Provider;
  commonTags: { [k: string]: string };
  redisName?: string;
  skuName?: string; // "Basic", "Standard", or "Premium"
  skuFamily?: string; // "C" or "P"
  capacity?: number; // C: 0-6, P: 1-5
  enableNonSsl?: boolean;
  evictionPolicy?: string;
}

export async function createRedisCache(args: RedisCacheArgs) {
  const name = args.redisName ?? "boreal-byoc-redis";
  const skuName = args.skuName ?? "Standard";
  const skuFamily = args.skuFamily ?? "C";
  const capacity = args.capacity ?? 1;
  const useZones = skuName === "Premium";

  const redisCache = new redis.Redis("redis-cache", {
    name,
    redisVersion: "6",
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    zones: useZones ? ["1", "2", "3"] : undefined,
    sku: {
      name: skuName,
      family: skuFamily,
      capacity: capacity,
    },
    minimumTlsVersion: "1.2",
    enableNonSslPort: args.enableNonSsl ?? false,
    redisConfiguration: {
      maxmemoryPolicy: args.evictionPolicy ?? "allkeys-lru",
    },
    tags: args.commonTags,
  });

  const keys = redis.listRedisKeysOutput({
    resourceGroupName: args.resourceGroupName,
    name: redisCache.name,
  });

  const host = redisCache.hostName;
  const port = pulumi.output(6380);
  const password = keys.primaryKey;

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
    cache: redisCache,
    secret: secret,
    serviceType: "cache" as const,
  };
}
