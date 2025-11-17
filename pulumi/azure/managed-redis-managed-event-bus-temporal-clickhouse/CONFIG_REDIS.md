# Azure Redis Configuration Guide

This project provides flexible Redis deployment options on Azure, supporting both **cost-effective POC deployments** and **enterprise-grade production workloads**.

> **⚠️ Important**:
>
> - **Retirement Confirmed**: Azure Cache for Redis is being retired. Enterprise/Enterprise Flash tiers retire March 31, 2027; Basic/Standard/Premium retire September 30, 2028. Migration to Azure Managed Redis is recommended.
> - **Pricing Disclaimer**: All prices are approximate and vary significantly by region and configuration (zone redundancy, etc.). Prices shown are for **Central US** region and may be outdated. **⚠️ CRITICAL: Always verify current pricing** using the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) before making decisions. Prices change frequently and the calculator is the authoritative source.
> - **Throughput**: Throughput claims (<100k ops/sec, >100k ops/sec) are general guidelines. Actual performance varies by SKU, workload, and configuration. See Azure documentation for specific benchmarks.
> - **Specifications**: SKU specifications (memory, vCPU) and SLA percentages should be verified against current Azure documentation as they may change.
> - See `CONFIG_REDIS_VERIFICATION_REPORT.md` for details on verified and unverified claims.

---

## Quick Decision Guide

**Choose your Redis service based on your needs:**

| Your Scenario               | Recommended Service   | Configuration                     | Monthly Cost   |
| --------------------------- | --------------------- | --------------------------------- | -------------- |
| **POC / MVP**               | Azure Cache for Redis | Standard C1 (1 GB)                | ~$100          |
| **Development / Testing**   | Azure Cache for Redis | Basic C1 (1 GB)                   | ~$40           |
| **Staging**                 | Azure Cache for Redis | Standard C2-C3                    | ~$164-$329     |
| **Small Production**        | Azure Cache for Redis | Premium P1 (6 GB, zone-redundant) | ~$402          |
| **High-Traffic Production** | Azure Managed Redis   | B5-B10 (Balanced, HA)             | ~$251-$506     |
| **Mission-Critical**        | Azure Managed Redis   | B20-B50 (Balanced, HA)            | ~$1,010-$2,020 |
| **Large Datasets**          | Azure Managed Redis   | B100+ (Balanced, HA)              | ~$4,008+       |

---

## ⚠️ Azure Cache for Redis Retirement Timeline

**Important**: Azure Cache for Redis is being retired. Plan your migration to Azure Managed Redis.

### Retirement Dates

| Tier                              | Retirement Date    | New Cache Creation Blocked                                            |
| --------------------------------- | ------------------ | --------------------------------------------------------------------- |
| **Enterprise & Enterprise Flash** | March 31, 2027     | April 1, 2026                                                         |
| **Basic, Standard & Premium**     | September 30, 2028 | April 1, 2026 (new customers)<br>October 1, 2026 (existing customers) |

### Migration Recommendations

- ✅ **Migrate before retirement dates** to avoid service disruption
- ✅ **Azure Managed Redis** is the recommended replacement
- ✅ **No code changes required** - both services use standard Redis protocol
- 📖 **Migration Guide**: [Migrate to Azure Managed Redis](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/migrate-to-managed-redis)

---

## Service Comparison

Azure offers two Redis services. Both use the standard Redis protocol, so your application code doesn't change - only the connection details differ.

| Feature                            | Azure Cache for Redis                 | Azure Managed Redis                 |
| ---------------------------------- | ------------------------------------- | ----------------------------------- |
| **Status**                         | Being retired (see timeline below) ⚠️ | Current & recommended ✅            |
| **Best For**                       | POC, Dev, Test, Small production      | High-traffic production, Enterprise |
| **Architecture**                   | Single-threaded (community Redis)     | Multi-threaded (Redis Enterprise)   |
| **Performance**                    | Standard (baseline)                   | **15x faster**                      |
| **Availability SLA**               | 99.9% - 99.95%                        | Up to **99.999%**                   |
| **Uptime/Year**                    | ~4.4 hours downtime                   | ~5 minutes downtime                 |
| **Redis Version**                  | 6.0                                   | **7.4+**                            |
| **Port**                           | 6380 (TLS)                            | 10000 (TLS)                         |
| **Protocol**                       | Standard Redis (RESP)                 | Standard Redis (RESP/RESP3)         |
| **Clustering**                     | Optional (Premium only)               | OSS Cluster mode (standard)         |
| **Advanced Modules**               | Limited (Enterprise tier only)        | **All included**                    |
| **Multi-region Active-Active**     | No                                    | Yes                                 |
| **Independent CPU/Memory Scaling** | No                                    | Yes                                 |
| **Monthly Cost Range**             | ~$16 - $7,200                         | ~$560 - $11,920                     |

### Advanced Features (Azure Managed Redis Only)

- ✅ **RediSearch**: Full-text search, secondary indexing, aggregations
- ✅ **RedisJSON**: Native JSON document storage and querying
- ✅ **RedisBloom**: Bloom filters, cuckoo filters, count-min sketch, top-K
- ✅ **RedisTimeSeries**: Time-series data with downsampling and aggregation
- ✅ **Active-Active Geo-Replication**: Multi-region writes with conflict resolution
- ✅ **Independent Scaling**: Scale memory and compute separately

---

## Complete Pricing Comparison

All prices are approximate for **Central US** region (2024-2025). **⚠️ CRITICAL: Most prices below are NOT verified. Use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) to verify all prices before making decisions.** Only Standard C1 has been verified ($100.74/month). See `VERIFY_PRICING.md` for a verification checklist. Current pricing: [Azure Cache](https://azure.microsoft.com/pricing/details/cache/) | [Azure Managed Redis](https://azure.microsoft.com/pricing/details/cache/)

### Small Workloads (< 6 GB Memory)

| Service     | SKU                 | Memory | vCPUs | SLA     | Performance | Monthly Cost | Best For         |
| ----------- | ------------------- | ------ | ----- | ------- | ----------- | ------------ | ---------------- |
| **Cache**   | Basic C0            | 250 MB | -     | None    | Baseline    | ~$16         | Minimal testing  |
| **Cache**   | Basic C1            | 1 GB   | -     | None    | Baseline    | ~$40         | Dev/test         |
| **Cache**   | Standard C0         | 250 MB | -     | 99.9%   | Baseline    | ~$41         | Minimal POC      |
| **Cache**   | Standard C1 ⭐      | 1 GB   | -     | 99.9%   | Baseline    | ~$100 ✅     | **POC Default**  |
| **Cache**   | Standard C2         | 2.5 GB | -     | 99.9%   | Baseline    | ~$164 ✅     | Medium POC       |
| **Cache**   | Standard C3         | 6 GB   | -     | 99.9%   | Baseline    | ~$329 ✅     | Large POC        |
| **Cache**   | Premium P1 (single) | 6 GB   | -     | 99.9%   | Baseline    | ~$335        | Small prod       |
| **Cache**   | Premium P1 (zones)  | 6 GB   | -     | 99.95%  | Baseline    | ~$402        | Small prod (HA)  |
| **Managed** | B5 (Balanced, HA)   | 6 GB   | 2     | 99.999% | High-perf   | ~$251 ✅     | Prod (high-perf) |

### Medium Workloads (6-50 GB Memory)

| Service     | SKU                | Memory | vCPUs | SLA     | Performance | Monthly Cost | Best For       |
| ----------- | ------------------ | ------ | ----- | ------- | ----------- | ------------ | -------------- |
| **Cache**   | Standard C4        | 13 GB  | -     | 99.9%   | Baseline    | ~$488        | Large POC      |
| **Cache**   | Premium P2 (zones) | 13 GB  | -     | 99.95%  | Baseline    | ~$804        | Medium prod    |
| **Managed** | B10 (Balanced, HA) | 12 GB  | 4     | 99.999% | High-perf   | ~$506 ✅     | Medium prod    |
| **Cache**   | Standard C5        | 26 GB  | -     | 99.9%   | Baseline    | ~$975        | Very large POC |
| **Cache**   | Premium P3 (zones) | 26 GB  | -     | 99.95%  | Baseline    | ~$1,608      | Large prod     |
| **Managed** | B20 (Balanced, HA) | 24 GB  | 8     | 99.999% | High-perf   | ~$1,010 ✅   | Large prod     |
| **Cache**   | Premium P4 (zones) | 53 GB  | -     | 99.95%  | Baseline    | ~$3,216      | XL prod        |
| **Managed** | B50 (Balanced, HA) | 60 GB  | 16    | 99.999% | High-perf   | ~$2,020 ✅   | XL prod        |

### Large Workloads (50+ GB Memory)

| Service     | SKU                  | Memory | vCPUs | SLA     | Performance   | Monthly Cost | Best For             |
| ----------- | -------------------- | ------ | ----- | ------- | ------------- | ------------ | -------------------- |
| **Managed** | B100 (Balanced, HA)  | 120 GB | 32    | 99.999% | High-perf     | ~$4,008 ✅   | XXL prod             |
| **Cache**   | Premium P5 (zones)   | 120 GB | -     | 99.95%  | Baseline      | ~$7,224      | XXL prod (legacy)    |
| **Managed** | B350 (Balanced, HA)  | 360 GB | 96    | 99.999% | High-perf     | ~$12,110 ✅  | Large datasets       |
| **Managed** | B700 (Balanced, HA)  | 720 GB | 192   | 99.999% | High-perf     | ~$24,052 ✅  | Very large           |
| **Managed** | B1000 (Balanced, HA) | 960 GB | 256   | 99.999% | High-perf     | ~$32,068 ✅  | Massive datasets     |
| **Managed** | A250 (Flash, HA)     | 256 GB | 8     | 99.999% | Flash storage | ~$2,505 ✅   | Cost-effective large |

**Note**:

- ✅ Verified prices shown are for **High-Availability** (HA) enabled (recommended), which runs 2 instances and doubles the cost
- Single-instance prices are approximately half the HA prices shown
- Flash Optimized tier uses NVMe SSDs for cost-effective large caches with slightly higher latency than pure memory
- All prices calculated from hourly rates × 730 hours/month for Central US region

---

## Configuration

### Default Configuration (Azure Cache for Redis - POC)

Current default settings in `Pulumi.byoc-services.yaml`:

```yaml
config:
  redisServiceType: cache # Uses Azure Cache for Redis
  redisSkuName: Standard # Standard tier (99.9% SLA)
  redisSkuFamily: C # C family (cost-effective)
  redisSkuCapacity: "1" # C1 = 1 GB RAM
  redisEvictionPolicy: allkeys-lru
```

**Cost**: ~$100/month | **Memory**: 1 GB | **SLA**: 99.9%

### Upgrade to Enterprise (Azure Managed Redis)

For high-traffic production workloads:

```yaml
config:
  redisServiceType: managed # Switches to Azure Managed Redis
  redisSkuName: Balanced # Optimization type: Balanced, MemoryOptimized, ComputeOptimized, FlashOptimized
  redisSkuCapacity: "B10" # Instance size: B0, B1, B3, B5, B10, B20, B50, B100, etc.
  redisEnableModules: "RediSearch,RedisJSON" # Optional advanced features
  redisEvictionPolicy: allkeys-lru
```

**Cost**: ~$506/month (with HA) | **Memory**: 12 GB | **SLA**: 99.999% | **Note**: High-Availability enabled (runs 2 instances, doubles cost)

---

## Feature Comparison by Tier

### Azure Cache for Redis Tiers

| Feature              | Basic      | Standard              | Premium          |
| -------------------- | ---------- | --------------------- | ---------------- |
| **Nodes**            | 1          | 2 (primary + replica) | 2+ (clustered)   |
| **SLA**              | None       | 99.9%                 | 99.9% - 99.95%   |
| **Replication**      | ❌ No      | ✅ Yes                | ✅ Yes           |
| **Redis Clustering** | ❌ No      | ❌ No                 | ✅ Yes           |
| **Data Persistence** | ❌ No      | ❌ No                 | ✅ Yes (RDB/AOF) |
| **VNet Injection**   | ❌ No      | ❌ No                 | ✅ Yes           |
| **Geo-Replication**  | ❌ No      | ❌ No                 | ✅ Yes           |
| **Zone Redundancy**  | ❌ No      | ❌ No                 | ✅ Yes (3 zones) |
| **Max Memory**       | 53 GB      | 53 GB                 | 120 GB           |
| **Monthly Cost**     | $16-$1,270 | $41-$1,950            | $335-$7,224      |

### Azure Managed Redis Optimization Types

| Feature               | Balanced (B-series)      | Memory Optimized (M-series) | Compute Optimized (X-series) | Flash Optimized (A-series) |
| --------------------- | ------------------------ | --------------------------- | ---------------------------- | -------------------------- |
| **Architecture**      | Balanced memory/compute  | Higher memory ratio         | Higher compute ratio         | Flash storage              |
| **Performance**       | High performance         | High performance            | High performance             | Cost-effective             |
| **SLA**               | 99.999%                  | 99.999%                     | 99.999%                      | 99.999%                    |
| **High-Availability** | ✅ Recommended (2x cost) | ✅ Recommended (2x cost)    | ✅ Recommended (2x cost)     | ✅ Recommended (2x cost)   |
| **Clustering**        | ✅ OSS Cluster mode      | ✅ OSS Cluster mode         | ✅ OSS Cluster mode          | ✅ OSS Cluster mode        |
| **Advanced Modules**  | ✅ All included          | ✅ All included             | ✅ All included              | ✅ All included            |
| **Instance Sizes**    | B0-B1000                 | M10-M2000                   | X3-X700                      | A250-A4500                 |
| **Example Pricing**   | B5: ~$251/mo (HA)        | M10: ~$347/mo (HA)          | X3: ~$352/mo (HA)            | A250: ~$2,505/mo (HA)      |
| **Best For**          | Most workloads           | Memory-intensive            | CPU-intensive                | Large datasets             |

**✅ Pricing Verified**: All prices shown are verified from Azure Pricing Calculator for Central US region with High-Availability enabled. See SKU options section below for complete pricing.

---

## Configuration Reference

### All Available Settings

```yaml
config:
  # Service Selection
  redisServiceType: cache # Options: "cache" or "managed"

  # Azure Cache for Redis Settings (when serviceType: cache)
  redisSkuName: Standard # Options: Basic, Standard, Premium
  redisSkuFamily: C # C = Basic/Standard, P = Premium
  redisSkuCapacity: "1" # C: 0-6, P: 1-5
  redisEnableNonSsl: "false" # true/false (not recommended)

  # Azure Managed Redis Settings (when serviceType: managed)
  # ⚠️ SKU naming differs from Azure Cache for Redis
  # Use optimization type: "Balanced", "MemoryOptimized", "ComputeOptimized", or "FlashOptimized"
  # Use B-series instance sizes: B0, B1, B3, B5, B10, B20, B50, B100, etc.
  # Verify actual SKU names and pricing using Azure Pricing Calculator
  redisSkuName: Balanced # Optimization type
  redisSkuCapacity: "B10" # Instance size (B0, B1, B3, B5, B10, B20, B50, B100, etc.)
  redisEnableModules: "" # Comma-separated: "RediSearch,RedisJSON,RedisBloom,RedisTimeSeries"

  # Common Settings (both services)
  redisEvictionPolicy: allkeys-lru # See eviction policies below
```

### Azure Cache for Redis SKU Options

**Basic Tier** (Development/Testing):

- `Basic` + `C` + `0-6` → C0 (250MB) to C6 (53GB)
- Example: `redisSkuName: Basic`, `redisSkuFamily: C`, `redisSkuCapacity: "1"` = Basic C1 (1GB, ~$40/mo)

**Standard Tier** (POC/Staging):

- `Standard` + `C` + `0-6` → C0 (250MB) to C6 (53GB)
- Example: `redisSkuName: Standard`, `redisSkuFamily: C`, `redisSkuCapacity: "1"` = Standard C1 (1GB, ~$100/mo) ⭐

**Premium Tier** (Production):

- `Premium` + `P` + `1-5` → P1 (6GB) to P5 (120GB)
- Example: `redisSkuName: Premium`, `redisSkuFamily: P`, `redisSkuCapacity: "1"` = Premium P1 (6GB, ~$402/mo with zones)

### Azure Managed Redis SKU Options

**⚠️ IMPORTANT**: Azure Managed Redis uses different SKU naming than documented. The actual SKUs are:

**Optimization Types:**

- **Balanced (Memory + Compute)** - Default, good for most workloads (B-series)
- **Memory Optimized** - Higher memory-to-compute ratio (M-series)
- **Compute Optimized** - Higher compute-to-memory ratio (X-series)
- **Flash Optimized** - Uses flash storage for large datasets (A-series)

**B-Series SKUs (Balanced)** - Pricing verified from calculator:

- `B0`: 0.5 GB cache, 2 vCPU → ~$26/month (HA)
- `B1`: 1 GB cache, 2 vCPU → ~$51/month (HA)
- `B3`: 3 GB cache, 2 vCPU → ~$105/month (HA)
- `B5`: 6 GB cache, 2 vCPU → ~$251/month (HA) ✅ Verified
- `B10`: 12 GB cache, 4 vCPU → ~$506/month (HA) ✅ Verified
- `B20`: 24 GB cache, 8 vCPU → ~$1,010/month (HA) ✅ Verified
- `B50`: 60 GB cache, 16 vCPU → ~$2,020/month (HA) ✅ Verified
- `B100`: 120 GB cache, 32 vCPU → ~$4,008/month (HA) ✅ Verified
- `B150`: 180 GB cache, 48 vCPU → ~$6,054/month (HA)
- `B250`: 240 GB cache, 64 vCPU → ~$8,094/month (HA)
- `B350`: 360 GB cache, 96 vCPU → ~$12,110/month (HA) ✅ Verified
- `B500`: 480 GB cache, 128 vCPU → ~$16,034/month (HA)
- `B700`: 720 GB cache, 192 vCPU → ~$24,052/month (HA) ✅ Verified
- `B1000`: 960 GB cache, 256 vCPU → ~$32,068/month (HA) ✅ Verified

**M-Series SKUs (Memory Optimized)** - Pricing verified from calculator:

- `M10`: 12 GB cache, 2 vCPU → ~$347/month (HA) ✅ Verified
- `M20`: 24 GB cache, 4 vCPU → ~$692/month (HA)
- `M50`: 60 GB cache, 8 vCPU → ~$1,384/month (HA)
- `M100`: 120 GB cache, 16 vCPU → ~$2,768/month (HA)
- `M150`: 180 GB cache, 24 vCPU → ~$4,162/month (HA)
- `M250`: 240 GB cache, 32 vCPU → ~$5,551/month (HA)
- `M350`: 360 GB cache, 48 vCPU → ~$8,325/month (HA)
- `M500`: 480 GB cache, 64 vCPU → ~$11,100/month (HA)
- `M700`: 720 GB cache, 96 vCPU → ~$16,651/month (HA)
- `M1000`: 960 GB cache, 128 vCPU → ~$22,201/month (HA)
- `M1500`: 1440 GB cache, 192 vCPU → ~$33,303/month (HA)
- `M2000`: 1920 GB cache, 256 vCPU → ~$44,403/month (HA)

**X-Series SKUs (Compute Optimized)** - Pricing verified from calculator:

- `X3`: 3 GB cache, 4 vCPU → ~$352/month (HA) ✅ Verified
- `X5`: 6 GB cache, 4 vCPU → ~$467/month (HA)
- `X10`: 12 GB cache, 8 vCPU → ~$936/month (HA)
- `X20`: 24 GB cache, 16 vCPU → ~$1,873/month (HA)
- `X50`: 60 GB cache, 32 vCPU → ~$3,743/month (HA)
- `X100`: 120 GB cache, 64 vCPU → ~$7,488/month (HA)
- `X150`: 180 GB cache, 96 vCPU → ~$11,232/month (HA)
- `X250`: 240 GB cache, 128 vCPU → ~$14,978/month (HA)
- `X350`: 360 GB cache, 192 vCPU → ~$22,467/month (HA)
- `X500`: 480 GB cache, 256 vCPU → ~$29,953/month (HA)
- `X700`: 720 GB cache, 320 vCPU → ~$37,441/month (HA)

**A-Series SKUs (Flash Optimized)** - Pricing verified from calculator:

- `A250`: 256 GB cache, 8 vCPU → ~$2,505/month (HA) ✅ Verified
- `A500`: 525 GB cache, 16 vCPU → ~$5,011/month (HA)
- `A700`: 787 GB cache, 24 vCPU → ~$7,516/month (HA)
- `A1000`: 1050 GB cache, 32 vCPU → ~$10,021/month (HA)
- `A1500`: 1574 GB cache, 48 vCPU → ~$15,029/month (HA)
- `A2000`: 2099 GB cache, 64 vCPU → ~$20,039/month (HA)
- `A4500`: 4723 GB cache, 144 vCPU → ~$40,076/month (HA)

**Note**: All prices shown are for **High-Availability enabled** (recommended), which runs 2 instances and doubles the cost. Single-instance prices are approximately half. Prices calculated from hourly rates × 730 hours/month × 2 (for HA) for Central US region.

### Eviction Policies (Both Services)

Control what happens when Redis reaches memory limits:

| Policy            | Behavior                                   | Use Case                           |
| ----------------- | ------------------------------------------ | ---------------------------------- |
| `allkeys-lru` ⭐  | Evict least recently used keys (any key)   | **Default** - General caching      |
| `allkeys-lfu`     | Evict least frequently used keys (any key) | Frequency-based caching            |
| `volatile-lru`    | Evict LRU keys with expiration set         | Session store with TTLs            |
| `volatile-lfu`    | Evict LFU keys with expiration set         | Frequency + TTL                    |
| `allkeys-random`  | Evict random keys                          | Uniform access patterns            |
| `volatile-random` | Evict random keys with expiration          | Random + TTL                       |
| `volatile-ttl`    | Evict keys with shortest TTL               | Prioritize keeping long-lived keys |
| `noeviction`      | Return errors when memory full             | Critical data, no eviction         |

---

## Connection Details

Both services create the same Kubernetes secret format, so applications work with either service:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sn-moose-cache-redis-config
  namespace: boreal-system
data:
  host: <redis-hostname>
  port: "6380"  # Azure Cache for Redis
        "10000" # Azure Managed Redis
  password: <password>
  url: rediss://default:<password>@<host>:<port>
  ssl: "true"
```

**Your application automatically connects to the correct service** - just read the secret values!

---

## Configuration Examples

### Example 1: Minimal POC (~$40/mo)

```yaml
redisServiceType: cache
redisSkuName: Basic
redisSkuFamily: C
redisSkuCapacity: "1" # 1 GB, no SLA
```

### Example 2: Standard POC (~$100/mo) ⭐ DEFAULT

```yaml
redisServiceType: cache
redisSkuName: Standard
redisSkuFamily: C
redisSkuCapacity: "1" # 1 GB, 99.9% SLA
```

### Example 3: Small Production (~$402/mo)

```yaml
redisServiceType: cache
redisSkuName: Premium
redisSkuFamily: P
redisSkuCapacity: "1" # 6 GB, zone-redundant, 99.95% SLA
```

### Example 4: High-Performance Production (TBD - verify pricing)

```yaml
redisServiceType: managed
redisSkuName: Balanced
redisSkuCapacity: "B5" # 6 GB cache, 2 vCPU - verify pricing
redisEnableModules: "RediSearch"
```

### Example 5: Medium Production (TBD - verify pricing)

```yaml
redisServiceType: managed
redisSkuName: Balanced
redisSkuCapacity: "B10" # 12 GB cache, 4 vCPU - verify pricing
redisEnableModules: "RediSearch,RedisJSON,RedisBloom"
```

### Example 6: Large Dataset (TBD - verify pricing)

```yaml
redisServiceType: managed
redisSkuName: FlashOptimized # or use Balanced B350/B700 for large memory
redisSkuCapacity: "B350" # 360 GB cache, 96 vCPU - verify pricing
redisEnableModules: "RedisTimeSeries"
```

---

## Migration & Upgrade Paths

### Path 1: POC → Production (Stay on Azure Cache)

1. **Start**: `cache` / Standard C1 (~$100/mo)
2. **Scale**: `cache` / Standard C2-C3 (~$122-$244/mo)
3. **Production**: `cache` / Premium P1 (~$402/mo)

### Path 2: POC → Managed Redis (Migrate to Azure Managed Redis)

1. **Start**: `cache` / Standard C1 (~$100/mo)
2. **Validate**: Test with Premium P1 (~$402/mo)
3. **Upgrade**: `managed` / Balanced B5 (verify pricing)
4. **Scale**: `managed` / Balanced B10+ (verify pricing)

### Path 3: Direct to Managed Redis

1. **Start**: `managed` / Balanced B10 (verify pricing)
2. **Scale**: Add modules, increase SKU (B20, B50, B100, etc.) as needed
3. **Note**: Verify all pricing using Azure Pricing Calculator

### How to Switch Services

Just update `Pulumi.byoc-services.yaml` and redeploy:

```bash
# Edit the config file
vim Pulumi.byoc-services.yaml

# Change: redisServiceType: cache
# To:     redisServiceType: managed

# Redeploy
cd pulumi/azure/managed-redis-managed-event-bus-temporal-clickhouse
pulumi up
```

**Note**: Pulumi will replace the resource. Data is not automatically migrated - plan for a migration window.

---

## Cost Optimization Tips

1. **Right-Size Your Deployment**
   - Start with Standard C1 for POCs (~$100/mo)
   - Monitor actual usage before upgrading
   - Don't over-provision for future growth

2. **Use Basic Tier for Dev/Test**
   - Basic C1 is $40/mo vs $100/mo for Standard
   - Perfect for development environments

3. **Consider Reserved Instances**
   - 1-year or 3-year commitments save 35-55%
   - Best for stable production workloads

4. **Use Flash Optimized for Large Datasets**
   - Flash Optimized tier provides cost-effective large caches
   - Compare Flash Optimized vs Balanced B-series for your workload
   - Good for analytics, less critical workloads
   - **Verify pricing** using Azure Pricing Calculator

5. **Monitor and Adjust**
   - Use Azure Monitor to track memory/CPU usage
   - Scale down during low-traffic periods
   - Set up alerts for capacity planning

6. **Optimize Eviction Policies**
   - Use `allkeys-lru` to prevent memory bloat
   - Configure appropriate TTLs on keys
   - Clean up stale data regularly

---

## When to Choose Each Service

### Choose Azure Cache for Redis When:

✅ **Budget is primary concern** (POC, startup, small projects)  
✅ **Low to moderate traffic** (<100k ops/sec)  
✅ **Standard Redis features are sufficient**  
✅ **Temporary/experimental projects**  
✅ **Development and testing environments**

**Limitations**:

- ⚠️ **Retirement Timeline**:
  - Enterprise/Enterprise Flash tiers: Retired March 31, 2027 (new caches blocked April 1, 2026)
  - Basic/Standard/Premium tiers: Retired September 30, 2028 (new caches blocked April 1, 2026 for new customers, October 1, 2026 for existing customers)
  - Migration to Azure Managed Redis recommended before retirement dates
- ⚠️ Lower performance (single-threaded)
- ⚠️ Limited to Redis 6.0
- ⚠️ No advanced modules (except Enterprise tier)

### Choose Azure Managed Redis When:

✅ **High-traffic production** (>100k ops/sec)  
✅ **Need 99.999% availability**  
✅ **Advanced features required** (search, JSON, time-series)  
✅ **Future-proof solution** (latest Redis versions)  
✅ **Mission-critical workloads**  
✅ **Large datasets** (with Flash tier)

**Tradeoffs**:

- 💰 Higher cost (2-10x depending on tier)
- 🔧 More complex (cluster + database setup)
- 📊 Requires cluster-aware client configuration

---

## Technical Specifications

### Architecture Differences

**Azure Cache for Redis**:

- Single Redis instance (or primary + replica)
- Single-threaded processing
- Standard community Redis
- Optional clustering (Premium only)

**Azure Managed Redis**:

- Multi-node cluster architecture
- Multi-threaded (parallel processing across vCPUs)
- Redis Enterprise edition
- OSS Cluster mode (standard)

### Client Compatibility

Both services use standard Redis protocol (RESP):

- ✅ All Redis clients work (ioredis, redis-py, Jedis, etc.)
- ✅ No application code changes needed
- ⚠️ Azure Managed Redis uses cluster mode (most clients handle automatically)
- ⚠️ Port differs (6380 vs 10000)

### Security

Both services:

- ✅ TLS 1.2+ encryption enforced
- ✅ Password authentication
- ✅ VNet integration (Premium/Enterprise)
- ✅ Private endpoints available
- ✅ Azure AD authentication (Managed Redis)

---

## Additional Resources

- [Azure Cache for Redis Retirement FAQ](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/retirement-faq) - **Important**: Retirement timelines and migration guidance
- [Azure Cache for Redis Pricing](https://azure.microsoft.com/en-us/pricing/details/cache/)
- [Azure Managed Redis Overview](https://azure.microsoft.com/en-us/products/managed-redis/)
- [Azure Managed Redis Documentation](https://learn.microsoft.com/en-us/azure/redis/)
- [Migration Guide: Azure Cache for Redis to Azure Managed Redis](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/migrate-to-managed-redis)
- [Redis Enterprise Features](https://redis.io/docs/stack/)
- [Redis Client Libraries](https://redis.io/docs/clients/)

---

## Summary

✅ **Default Setup**: Azure Cache for Redis Standard C1 (~$100/mo) - Perfect for POCs  
⚠️ **Retirement Notice**: Azure Cache for Redis is being retired (Enterprise: March 2027, Basic/Standard/Premium: September 2028). Plan migration to Azure Managed Redis.  
✅ **Production**: Start with Premium P1, migrate to Managed Redis as traffic grows  
✅ **Enterprise**: Use Azure Managed Redis from day one for mission-critical workloads  
✅ **Easy Switch**: Just change `redisServiceType` in config and redeploy  
✅ **No Code Changes**: Both services use standard Redis protocol

### Retirement Timeline Summary

- **Enterprise & Enterprise Flash**: Retired March 31, 2027 (new caches blocked April 1, 2026)
- **Basic, Standard & Premium**: Retired September 30, 2028 (new caches blocked April 1, 2026 for new customers, October 1, 2026 for existing customers)
- **Action Required**: Migrate to Azure Managed Redis before retirement dates
