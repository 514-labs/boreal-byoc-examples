import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createRedisCache, RedisCacheArgs } from "./redis-cache";
import { createRedisEnterprise, RedisEnterpriseArgs } from "./redis-enterprise";

/**
 * Azure Redis - Unified Interface
 *
 * This module provides a flexible interface for deploying Redis on Azure.
 * It supports two distinct services:
 *
 * 1. **Azure Cache for Redis** (redis-cache.ts)
 *    - DEFAULT: Cost-effective for POC/Development
 *    - Standard Redis (community edition)
 *    - ~$40-$400/mo
 *    - Port: 6380 (TLS)
 *
 * 2. **Azure Managed Redis** (redis-enterprise.ts)
 *    - OPTIONAL: Enterprise-grade for production
 *    - Redis Enterprise (15x faster)
 *    - ~$560-$8,000/mo
 *    - Port: 10000 (TLS)
 *    - Includes: RediSearch, RedisJSON, RedisBloom, RedisTimeSeries
 *
 * Usage:
 *   Set `serviceType: "cache"` or `"managed"` in Pulumi.byoc-services.yaml
 *
 * For detailed pricing and configuration, see: REDIS_CONFIGURATION.md
 */

export interface RedisArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  k8sProvider: k8s.Provider;
  commonTags: { [k: string]: string };

  // Common settings
  redisName?: string;
  serviceType?: "cache" | "managed"; // "cache" = Azure Cache for Redis, "managed" = Azure Managed Redis

  // SKU settings (used by both cache and managed)
  skuName?: string; // Cache: "Basic", "Standard", "Premium" | Managed: "Enterprise", "EnterpriseFlash"
  skuFamily?: string; // Cache only: "C" or "P" (ignored for managed)
  capacity?: number; // Cache: C:0-6, P:1-5 | Managed: Enterprise:2/4/6/10, EnterpriseFlash:300/700/1500

  // Cache-specific settings
  enableNonSsl?: boolean;

  // Managed-specific settings
  enableModules?: string[]; // Managed only: ["RediSearch", "RedisJSON", etc.]

  // Common settings (both services)
  evictionPolicy?: string; // Default: "allkeys-lru"
}

/**
 * Creates either Azure Cache for Redis or Azure Managed Redis
 * based on the serviceType parameter.
 *
 * Both services create a Kubernetes secret with connection details
 * at the same location (boreal-system/sn-moose-cache-redis-config),
 * so applications can seamlessly switch between them.
 */
export async function createAzureRedis(args: RedisArgs) {
  const serviceType = args.serviceType ?? "cache"; // Default to Azure Cache for Redis

  if (serviceType === "managed") {
    // Route to Azure Managed Redis (Enterprise)
    const enterpriseArgs: RedisEnterpriseArgs = {
      resourceGroupName: args.resourceGroupName,
      location: args.location,
      k8sProvider: args.k8sProvider,
      commonTags: args.commonTags,
      redisName: args.redisName,
      skuName: args.skuName,
      capacity: args.capacity,
      enableModules: args.enableModules,
      evictionPolicy: args.evictionPolicy,
    };
    return createRedisEnterprise(enterpriseArgs);
  } else {
    // Route to Azure Cache for Redis (Community)
    const cacheArgs: RedisCacheArgs = {
      resourceGroupName: args.resourceGroupName,
      location: args.location,
      k8sProvider: args.k8sProvider,
      commonTags: args.commonTags,
      redisName: args.redisName,
      skuName: args.skuName,
      skuFamily: args.skuFamily,
      capacity: args.capacity,
      enableNonSsl: args.enableNonSsl,
      evictionPolicy: args.evictionPolicy,
    };
    return createRedisCache(cacheArgs);
  }
}
