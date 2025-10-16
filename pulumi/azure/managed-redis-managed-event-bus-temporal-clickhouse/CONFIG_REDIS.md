# Azure Redis Configuration Guide

This project provides flexible Redis deployment options on Azure, supporting both **cost-effective POC deployments** and **enterprise-grade production workloads**.

---

## Quick Decision Guide

**Choose your Redis service based on your needs:**

| Your Scenario               | Recommended Service   | Configuration                     | Monthly Cost |
| --------------------------- | --------------------- | --------------------------------- | ------------ |
| **POC / MVP**               | Azure Cache for Redis | Standard C1 (1 GB)                | ~$65         |
| **Development / Testing**   | Azure Cache for Redis | Basic C1 (1 GB)                   | ~$40         |
| **Staging**                 | Azure Cache for Redis | Standard C2-C3                    | ~$122-$244   |
| **Small Production**        | Azure Cache for Redis | Premium P1 (6 GB, zone-redundant) | ~$402        |
| **High-Traffic Production** | Azure Managed Redis   | Enterprise_E5-E10                 | ~$560-$992   |
| **Mission-Critical**        | Azure Managed Redis   | Enterprise_E20+                   | ~$1,984+     |
| **Large Datasets**          | Azure Managed Redis   | EnterpriseFlash_F300+             | ~$2,980+     |

---

## Service Comparison

Azure offers two Redis services. Both use the standard Redis protocol, so your application code doesn't change - only the connection details differ.

| Feature                            | Azure Cache for Redis             | Azure Managed Redis                 |
| ---------------------------------- | --------------------------------- | ----------------------------------- |
| **Status**                         | Being retired by Microsoft ⚠️     | Current & recommended ✅            |
| **Best For**                       | POC, Dev, Test, Small production  | High-traffic production, Enterprise |
| **Architecture**                   | Single-threaded (community Redis) | Multi-threaded (Redis Enterprise)   |
| **Performance**                    | Standard (baseline)               | **15x faster**                      |
| **Availability SLA**               | 99.9% - 99.95%                    | Up to **99.999%**                   |
| **Uptime/Year**                    | ~4.4 hours downtime               | ~5 minutes downtime                 |
| **Redis Version**                  | 6.0                               | **7.4+**                            |
| **Port**                           | 6380 (TLS)                        | 10000 (TLS)                         |
| **Protocol**                       | Standard Redis (RESP)             | Standard Redis (RESP/RESP3)         |
| **Clustering**                     | Optional (Premium only)           | OSS Cluster mode (standard)         |
| **Advanced Modules**               | Limited (Enterprise tier only)    | **All included**                    |
| **Multi-region Active-Active**     | No                                | Yes                                 |
| **Independent CPU/Memory Scaling** | No                                | Yes                                 |
| **Monthly Cost Range**             | ~$16 - $7,200                     | ~$560 - $11,920                     |

### Advanced Features (Azure Managed Redis Only)

- ✅ **RediSearch**: Full-text search, secondary indexing, aggregations
- ✅ **RedisJSON**: Native JSON document storage and querying
- ✅ **RedisBloom**: Bloom filters, cuckoo filters, count-min sketch, top-K
- ✅ **RedisTimeSeries**: Time-series data with downsampling and aggregation
- ✅ **Active-Active Geo-Replication**: Multi-region writes with conflict resolution
- ✅ **Independent Scaling**: Scale memory and compute separately

---

## Complete Pricing Comparison

All prices are approximate for **East US** region (2024-2025). Current pricing: [Azure Cache](https://azure.microsoft.com/pricing/details/cache/) | [Azure Managed Redis](https://azure.microsoft.com/pricing/details/cache/)

### Small Workloads (< 6 GB Memory)

| Service     | SKU                 | Memory | vCPUs | SLA     | Performance    | Monthly Cost | Best For         |
| ----------- | ------------------- | ------ | ----- | ------- | -------------- | ------------ | ---------------- |
| **Cache**   | Basic C0            | 250 MB | -     | None    | Baseline       | ~$16         | Minimal testing  |
| **Cache**   | Basic C1            | 1 GB   | -     | None    | Baseline       | ~$40         | Dev/test         |
| **Cache**   | Standard C0         | 250 MB | -     | 99.9%   | Baseline       | ~$41         | Minimal POC      |
| **Cache**   | Standard C1 ⭐      | 1 GB   | -     | 99.9%   | Baseline       | ~$65         | **POC Default**  |
| **Cache**   | Standard C2         | 2.5 GB | -     | 99.9%   | Baseline       | ~$122        | Medium POC       |
| **Cache**   | Standard C3         | 6 GB   | -     | 99.9%   | Baseline       | ~$244        | Large POC        |
| **Cache**   | Premium P1 (single) | 6 GB   | -     | 99.9%   | Baseline       | ~$335        | Small prod       |
| **Cache**   | Premium P1 (zones)  | 6 GB   | -     | 99.95%  | Baseline       | ~$402        | Small prod (HA)  |
| **Managed** | Enterprise_E5       | 6 GB   | 5     | 99.999% | **15x faster** | ~$560        | Prod (high-perf) |

### Medium Workloads (6-50 GB Memory)

| Service     | SKU                | Memory | vCPUs | SLA     | Performance    | Monthly Cost | Best For       |
| ----------- | ------------------ | ------ | ----- | ------- | -------------- | ------------ | -------------- |
| **Cache**   | Standard C4        | 13 GB  | -     | 99.9%   | Baseline       | ~$488        | Large POC      |
| **Cache**   | Premium P2 (zones) | 13 GB  | -     | 99.95%  | Baseline       | ~$804        | Medium prod    |
| **Managed** | Enterprise_E10     | 12 GB  | 10    | 99.999% | **15x faster** | ~$992        | Medium prod    |
| **Cache**   | Standard C5        | 26 GB  | -     | 99.9%   | Baseline       | ~$975        | Very large POC |
| **Cache**   | Premium P3 (zones) | 26 GB  | -     | 99.95%  | Baseline       | ~$1,608      | Large prod     |
| **Managed** | Enterprise_E20     | 25 GB  | 20    | 99.999% | **15x faster** | ~$1,984      | Large prod     |
| **Cache**   | Premium P4 (zones) | 53 GB  | -     | 99.95%  | Baseline       | ~$3,216      | XL prod        |
| **Managed** | Enterprise_E50     | 50 GB  | 40    | 99.999% | **15x faster** | ~$3,968      | XL prod        |

### Large Workloads (50+ GB Memory)

| Service     | SKU                   | Memory  | vCPUs | SLA     | Performance    | Monthly Cost | Best For          |
| ----------- | --------------------- | ------- | ----- | ------- | -------------- | ------------ | ----------------- |
| **Managed** | Enterprise_E100       | 100 GB  | 80    | 99.999% | **15x faster** | ~$7,936      | XXL prod          |
| **Cache**   | Premium P5 (zones)    | 120 GB  | -     | 99.95%  | Baseline       | ~$7,224      | XXL prod (legacy) |
| **Managed** | EnterpriseFlash_F300  | 300 GB  | -     | 99.999% | Fast (flash)   | ~$2,980      | Large datasets    |
| **Managed** | EnterpriseFlash_F700  | 700 GB  | -     | 99.999% | Fast (flash)   | ~$5,960      | Very large        |
| **Managed** | EnterpriseFlash_F1500 | 1500 GB | -     | 99.999% | Fast (flash)   | ~$11,920     | Massive datasets  |

**Note**: Flash tier uses NVMe SSDs for cost-effective large caches with slightly higher latency than pure memory.

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

**Cost**: ~$65/month | **Memory**: 1 GB | **SLA**: 99.9%

### Upgrade to Enterprise (Azure Managed Redis)

For high-traffic production workloads:

```yaml
config:
  redisServiceType: managed # Switches to Azure Managed Redis
  redisSkuName: Enterprise # Tier: "Enterprise" or "EnterpriseFlash"
  redisCapacity: 10 # Capacity: 2/4/6/10 (or 300/700/1500 for Flash)
  redisEnableModules: "RediSearch,RedisJSON" # Optional advanced features
  redisEvictionPolicy: allkeys-lru
```

**Cost**: ~$992/month | **Memory**: 12 GB | **SLA**: 99.999% | **Performance**: 15x faster

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

### Azure Managed Redis Tiers

| Feature               | Enterprise (Memory)   | EnterpriseFlash (Hybrid) |
| --------------------- | --------------------- | ------------------------ |
| **Architecture**      | Pure in-memory        | Memory + NVMe SSD        |
| **Performance**       | 15x faster than Cache | 10x faster than Cache    |
| **SLA**               | 99.999%               | 99.999%                  |
| **Zone Redundancy**   | ✅ Yes (3 zones)      | ✅ Yes (3 zones)         |
| **Clustering**        | ✅ OSS Cluster mode   | ✅ OSS Cluster mode      |
| **Advanced Modules**  | ✅ All included       | ✅ All included          |
| **Active-Active Geo** | ✅ Available          | ✅ Available             |
| **Memory Range**      | 6-100 GB              | 300-1500 GB              |
| **Monthly Cost**      | $560-$7,936           | $2,980-$11,920           |

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
  redisEnterpriseSkuName: Enterprise_E10 # Options below
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
- Example: `redisSkuName: Standard`, `redisSkuFamily: C`, `redisSkuCapacity: "1"` = Standard C1 (1GB, ~$65/mo) ⭐

**Premium Tier** (Production):

- `Premium` + `P` + `1-5` → P1 (6GB) to P5 (120GB)
- Example: `redisSkuName: Premium`, `redisSkuFamily: P`, `redisSkuCapacity: "1"` = Premium P1 (6GB, ~$402/mo with zones)

### Azure Managed Redis SKU Options

**Enterprise Tier** (High-Performance):

- `Enterprise_E5` (6GB, 5 vCPUs, ~$560/mo)
- `Enterprise_E10` (12GB, 10 vCPUs, ~$992/mo)
- `Enterprise_E20` (25GB, 20 vCPUs, ~$1,984/mo)
- `Enterprise_E50` (50GB, 40 vCPUs, ~$3,968/mo)
- `Enterprise_E100` (100GB, 80 vCPUs, ~$7,936/mo)

**EnterpriseFlash Tier** (Large Datasets):

- `EnterpriseFlash_F300` (300GB, ~$2,980/mo)
- `EnterpriseFlash_F700` (700GB, ~$5,960/mo)
- `EnterpriseFlash_F1500` (1500GB, ~$11,920/mo)

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

### Example 2: Standard POC (~$65/mo) ⭐ DEFAULT

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

### Example 4: High-Performance Production (~$560/mo)

```yaml
redisServiceType: managed
redisEnterpriseSkuName: Enterprise_E5 # 6 GB, 5 vCPUs, 15x faster
redisEnableModules: "RediSearch"
```

### Example 5: Enterprise Production (~$992/mo)

```yaml
redisServiceType: managed
redisEnterpriseSkuName: Enterprise_E10 # 12 GB, 10 vCPUs
redisEnableModules: "RediSearch,RedisJSON,RedisBloom"
```

### Example 6: Large Dataset (~$2,980/mo)

```yaml
redisServiceType: managed
redisEnterpriseSkuName: EnterpriseFlash_F300 # 300 GB (hybrid storage)
redisEnableModules: "RedisTimeSeries"
```

---

## Migration & Upgrade Paths

### Path 1: POC → Production (Stay on Azure Cache)

1. **Start**: `cache` / Standard C1 (~$65/mo)
2. **Scale**: `cache` / Standard C2-C3 (~$122-$244/mo)
3. **Production**: `cache` / Premium P1 (~$402/mo)

### Path 2: POC → Enterprise (Migrate to Managed Redis)

1. **Start**: `cache` / Standard C1 (~$65/mo)
2. **Validate**: Test with Premium P1 (~$402/mo)
3. **Upgrade**: `managed` / Enterprise_E5 (~$560/mo)
4. **Scale**: `managed` / Enterprise_E10+ (~$992+/mo)

### Path 3: Direct to Enterprise

1. **Start**: `managed` / Enterprise_E10 (~$992/mo)
2. **Scale**: Add modules, increase SKU as needed

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
   - Start with Standard C1 for POCs (~$65/mo)
   - Monitor actual usage before upgrading
   - Don't over-provision for future growth

2. **Use Basic Tier for Dev/Test**
   - Basic C1 is $40/mo vs $65/mo for Standard
   - Perfect for development environments

3. **Consider Reserved Instances**
   - 1-year or 3-year commitments save 35-55%
   - Best for stable production workloads

4. **Use Flash Tier for Large Datasets**
   - EnterpriseFlash_F300 ($2,980/mo) vs Enterprise_E100 ($7,936/mo)
   - 3x the storage at ~40% the cost
   - Good for analytics, less critical workloads

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

- ⚠️ Being retired by Microsoft (migration required eventually)
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

- [Azure Cache for Redis Pricing](https://azure.microsoft.com/en-us/pricing/details/cache/)
- [Azure Managed Redis Overview](https://azure.microsoft.com/en-us/products/managed-redis/)
- [Azure Managed Redis Documentation](https://learn.microsoft.com/en-us/azure/redis/)
- [Redis Enterprise Features](https://redis.io/docs/stack/)
- [Migration Guide](https://learn.microsoft.com/en-us/azure/redis/migrate/)
- [Redis Client Libraries](https://redis.io/docs/clients/)

---

## Summary

✅ **Default Setup**: Azure Cache for Redis Standard C1 (~$65/mo) - Perfect for POCs  
✅ **Production**: Start with Premium P1, migrate to Managed Redis as traffic grows  
✅ **Enterprise**: Use Azure Managed Redis from day one for mission-critical workloads  
✅ **Easy Switch**: Just change `redisServiceType` in config and redeploy  
✅ **No Code Changes**: Both services use standard Redis protocol
