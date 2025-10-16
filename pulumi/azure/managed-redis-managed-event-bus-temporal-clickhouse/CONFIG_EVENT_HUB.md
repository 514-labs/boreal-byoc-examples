# Azure Event Hubs Configuration Guide

This project provides flexible Event Hubs deployment options on Azure, supporting both **cost-effective POC deployments** and **enterprise-grade production workloads**.

Azure Event Hubs provides a **Kafka-compatible** event streaming platform, so you can use standard Kafka clients without code changes.

---

## Quick Decision Guide

**Choose your Event Hubs tier based on your needs:**

| Your Scenario               | Recommended Tier | Configuration       | Monthly Cost   | Throughput      |
| --------------------------- | ---------------- | ------------------- | -------------- | --------------- |
| **POC / MVP**               | Standard         | 2 TUs, auto-inflate | ~$45           | 2 MB/s ingress  |
| **Development / Testing**   | Basic            | 1 TU                | ~$11           | 1 MB/s ingress  |
| **Staging**                 | Standard         | 5 TUs, auto-inflate | ~$113          | 5 MB/s ingress  |
| **Small Production**        | Standard         | 10 TUs              | ~$225          | 10 MB/s ingress |
| **Medium Production**       | Standard         | 20 TUs              | ~$450          | 20 MB/s ingress |
| **High-Traffic Production** | Premium          | 2-4 PUs             | ~$1,800-$3,600 | Dedicated       |
| **Mission-Critical**        | Premium          | 8-16 PUs            | ~$7,200+       | Dedicated       |

**TU** = Throughput Unit | **PU** = Processing Unit (dedicated)

---

## Service Comparison

Azure Event Hubs offers four tiers, all using the standard Kafka protocol, so your application code doesn't change - only the connection details differ.

| Feature                            | Basic           | Standard               | Premium                 | Dedicated               |
| ---------------------------------- | --------------- | ---------------------- | ----------------------- | ----------------------- |
| **Best For**                       | Dev, Test, POC  | Production workloads   | Mission-critical        | Ultra-high performance  |
| **Throughput Model**               | Shared capacity | Shared capacity        | **Dedicated capacity**  | **Maximum capacity**    |
| **Capacity Units**                 | 1-20 TUs        | 1-20 TUs               | 1-16 PUs                | 1-4 CUs                 |
| **Ingress**                        | 1 MB/s per TU   | 1 MB/s per TU          | **Up to 200 MB/s**      | **Up to 800 MB/s**      |
| **Egress**                         | 2 MB/s per TU   | 2 MB/s per TU          | **Up to 400 MB/s**      | **Up to 1600 MB/s**     |
| **Events/Second**                  | 1,000 per TU    | 1,000 per TU           | **100,000+ per PU**     | **200,000+ per CU**     |
| **Auto-Inflate**                   | ❌ No           | ✅ Yes                 | ✅ Yes                  | ✅ Yes                  |
| **Availability SLA**               | 99.95%          | 99.95%                 | **99.99%**              | **99.99%**              |
| **Message Retention**              | 1 day           | 1-7 days               | **1-90 days**           | **1-90 days**           |
| **Consumer Groups**                | 1               | 20                     | **1000**                | **1000**                |
| **Partitions**                     | Up to 32        | Up to 32               | **Up to 100**           | **Up to 100**           |
| **Kafka Support**                  | ✅ Yes (1.0+)   | ✅ Yes (1.0+)          | ✅ Yes (1.0+)           | ✅ Yes (1.0+)           |
| **Schema Registry**                | ❌ No           | ❌ No                  | ✅ Yes                  | ✅ Yes                  |
| **Geo-Disaster Recovery**          | ❌ No           | ✅ Yes (metadata only) | ✅ Yes (metadata only)  | ✅ Yes (metadata only)  |
| **Customer-Managed Keys**          | ❌ No           | ❌ No                  | ✅ Yes                  | ✅ Yes                  |
| **VNet Integration**               | ❌ No           | Limited (IP firewall)  | ✅ Full (Private Links) | ✅ Full (Private Links) |
| **Zone Redundancy**                | ❌ No           | ✅ Available           | ✅ Standard             | ✅ Standard             |
| **Capture (to Storage/Data Lake)** | ❌ No           | ✅ Yes                 | ✅ Yes                  | ✅ Yes                  |
| **Monthly Cost Range**             | ~$11 - $225     | ~$22 - $450            | ~$900 - $14,400         | ~$5,000 - $20,000       |

---

## Complete Pricing Comparison

All prices are approximate for **East US** region (2024-2025). Current pricing: [Azure Event Hubs Pricing](https://azure.microsoft.com/pricing/details/event-hubs/)

### Basic Tier (Development/Testing)

| Configuration | Throughput Units | Ingress | Egress  | Retention | Monthly Cost | Best For     |
| ------------- | ---------------- | ------- | ------- | --------- | ------------ | ------------ |
| Basic 1 TU    | 1                | 1 MB/s  | 2 MB/s  | 1 day     | ~$11         | Minimal test |
| Basic 5 TUs   | 5                | 5 MB/s  | 10 MB/s | 1 day     | ~$56         | Dev env      |
| Basic 10 TUs  | 10               | 10 MB/s | 20 MB/s | 1 day     | ~$113        | Large dev    |
| Basic 20 TUs  | 20               | 20 MB/s | 40 MB/s | 1 day     | ~$225        | Max capacity |

**Pricing**: ~$11/TU per month

**Limitations**:

- ❌ No auto-inflate (manual scaling only)
- ❌ Single consumer group only
- ❌ 1-day retention only
- ❌ No capture to storage

### Standard Tier (Production) ⭐ DEFAULT

| Configuration     | Throughput Units | Ingress | Egress  | Retention | Monthly Cost | Best For        |
| ----------------- | ---------------- | ------- | ------- | --------- | ------------ | --------------- |
| Standard 1 TU     | 1                | 1 MB/s  | 2 MB/s  | 1-7 days  | ~$22         | Minimal POC     |
| Standard 2 TUs ⭐ | 2                | 2 MB/s  | 4 MB/s  | 1-7 days  | ~$45         | **POC Default** |
| Standard 5 TUs    | 5                | 5 MB/s  | 10 MB/s | 1-7 days  | ~$113        | Medium POC      |
| Standard 10 TUs   | 10               | 10 MB/s | 20 MB/s | 1-7 days  | ~$225        | Small prod      |
| Standard 20 TUs   | 20               | 20 MB/s | 40 MB/s | 1-7 days  | ~$450        | Max capacity    |

**Pricing**: ~$22/TU per month

**Features**:

- ✅ Auto-inflate (automatically scale TUs based on traffic)
- ✅ Up to 20 consumer groups
- ✅ 1-7 day retention
- ✅ Capture to Azure Storage/Data Lake
- ✅ 32 partitions
- ✅ Zone redundancy available

### Premium Tier (Enterprise)

| Configuration  | Processing Units | Throughput | Retention | Zone Redundant | Monthly Cost | Best For         |
| -------------- | ---------------- | ---------- | --------- | -------------- | ------------ | ---------------- |
| Premium 1 PU   | 1                | ~50 MB/s   | 1-90 days | ✅ Yes         | ~$900        | Small prod       |
| Premium 2 PUs  | 2                | ~100 MB/s  | 1-90 days | ✅ Yes         | ~$1,800      | Medium prod      |
| Premium 4 PUs  | 4                | ~200 MB/s  | 1-90 days | ✅ Yes         | ~$3,600      | Large prod       |
| Premium 8 PUs  | 8                | ~400 MB/s  | 1-90 days | ✅ Yes         | ~$7,200      | High-traffic     |
| Premium 16 PUs | 16               | ~800 MB/s  | 1-90 days | ✅ Yes         | ~$14,400     | Mission-critical |

<<<<<<< Current (Your changes)
**Pricing**: ~$678/PU per month (includes dedicated compute)
=======
**Pricing**: ~$900/PU per month ($1.233/hour per PU)

> > > > > > > Incoming (Background Agent changes)

**Features**:

- ✅ **Dedicated processing units** (no noisy neighbors)
- ✅ **Consistent performance** (predictable latency)
- ✅ Up to 1000 consumer groups
- ✅ Up to 90-day retention
- ✅ Up to 100 partitions
- ✅ Full VNet integration with Private Link
- ✅ Customer-managed encryption keys
- ✅ Schema Registry (Confluent-compatible)
- ✅ Self-serve scaling (scale PUs dynamically)
- ✅ Zone redundancy (always enabled)
- ✅ 99.99% SLA

### Dedicated Tier (Ultra-High Performance)

| Configuration   | Capacity Units | Throughput | Retention | Zone Redundant | Monthly Cost | Best For        |
| --------------- | -------------- | ---------- | --------- | -------------- | ------------ | --------------- |
| Dedicated 1 CU  | 1              | ~200 MB/s  | 1-90 days | ✅ Yes         | ~$5,000      | Ultra-high perf |
| Dedicated 2 CUs | 2              | ~400 MB/s  | 1-90 days | ✅ Yes         | ~$10,000     | Extreme scale   |
| Dedicated 4 CUs | 4              | ~800 MB/s  | 1-90 days | ✅ Yes         | ~$20,000     | Massive scale   |

**Pricing**: ~$5,000/CU per month ($6.849/hour per CU)

**Features**:

- ✅ **Maximum performance** (highest throughput tier)
- ✅ **Ultra-low latency** (optimized for extreme workloads)
- ✅ All Premium tier features included
- ✅ Highest throughput capacity
- ✅ Zone redundancy (always enabled)
- ✅ 99.99% SLA

---

## Configuration

### Default Configuration (Standard Tier - POC)

Current default settings in `Pulumi.byoc-services.yaml`:

```yaml
config:
  eventHubSkuName: Standard # Standard tier (99.95% SLA)
  eventHubSkuTier: Standard # Must match skuName
  eventHubSkuCapacity: "2" # 2 throughput units
  eventHubMaxThroughputUnits: "10" # Auto-scale up to 10 TUs
  eventHubPartitions: "8" # 8 partitions for parallelism
  eventHubMessageRetention: "7" # 7 days retention
```

**Cost**: ~$45/month | **Throughput**: 2 MB/s ingress (auto-scales to 10 MB/s) | **SLA**: 99.95%

### Upgrade to Premium (Dedicated Capacity)

For high-traffic production workloads:

```yaml
config:
  eventHubSkuName: Premium # Dedicated processing units
  eventHubSkuTier: Premium # Must match skuName
  eventHubSkuCapacity: "2" # 2 processing units
  eventHubMaxThroughputUnits: "4" # Can auto-scale to 4 PUs
  eventHubPartitions: "32" # More partitions for parallelism
  eventHubMessageRetention: "30" # 30 days retention
```

**Cost**: ~$1,800/month | **Throughput**: ~100 MB/s (dedicated) | **SLA**: 99.99% | **Retention**: 30 days

---

## Feature Comparison by Tier

### Throughput Capacity

| Tier     | Unit Type       | Per Unit Ingress | Per Unit Egress | Per Unit Events/Sec | Max Throughput     |
| -------- | --------------- | ---------------- | --------------- | ------------------- | ------------------ |
| Basic    | Throughput Unit | 1 MB/s           | 2 MB/s          | 1,000               | 20 MB/s (20 TUs)   |
| Standard | Throughput Unit | 1 MB/s           | 2 MB/s          | 1,000               | 20 MB/s (20 TUs)   |
| Premium  | Processing Unit | ~50 MB/s         | ~100 MB/s       | 50,000+             | 800+ MB/s (16 PUs) |

**Note**: Premium PUs provide **~50x better performance** per unit compared to TUs.

### Partitioning & Consumer Groups

| Tier     | Max Partitions | Consumer Groups | Recommended Partitions | Use Case                  |
| -------- | -------------- | --------------- | ---------------------- | ------------------------- |
| Basic    | 32             | 1               | 4-8                    | Single consumer app       |
| Standard | 32             | 20              | 8-16                   | Multiple consumer apps    |
| Premium  | 100            | 1000            | 16-32                  | Large-scale microservices |

**Partitions** = Parallelism (1 partition = 1 concurrent consumer)  
**Consumer Groups** = Independent sets of consumers (e.g., different apps reading same stream)

### Message Retention

| Tier     | Min Retention | Max Retention | Configurable | Best For                    |
| -------- | ------------- | ------------- | ------------ | --------------------------- |
| Basic    | 1 day         | 1 day         | ❌ No        | Real-time only              |
| Standard | 1 day         | 7 days        | ✅ Yes       | Short replay windows        |
| Premium  | 1 day         | 90 days       | ✅ Yes       | Compliance, auditing, debug |

### High Availability & Disaster Recovery

| Feature                   | Basic  | Standard | Premium    |
| ------------------------- | ------ | -------- | ---------- |
| **SLA**                   | 99.95% | 99.95%   | **99.99%** |
| **Zone Redundancy**       | ❌ No  | ✅ Yes   | ✅ Always  |
| **Geo-DR (Metadata)**     | ❌ No  | ✅ Yes   | ✅ Yes     |
| **Private Link**          | ❌ No  | ❌ No    | ✅ Yes     |
| **VNet Service Endpoint** | ❌ No  | ✅ Yes   | ✅ Yes     |

**Zone Redundancy**: Data replicated across 3 availability zones  
**Geo-DR**: Failover to secondary region (namespace metadata only, not messages)

---

## Configuration Reference

### All Available Settings

```yaml
config:
  # Event Hub Namespace SKU
  eventHubSkuName: Standard # Options: Basic, Standard, Premium
  eventHubSkuTier: Standard # Must match skuName

  # Capacity Configuration
  eventHubSkuCapacity: "2" # TUs (Basic/Standard: 1-20) or PUs (Premium: 1-16)
  eventHubMaxThroughputUnits: "10" # Auto-inflate max (Standard/Premium only)

  # Event Hub Instance Configuration
  eventHubPartitions: "8" # Partitions: 1-32 (Basic/Standard), 1-100 (Premium)
  eventHubMessageRetention: "7" # Days: 1 (Basic), 1-7 (Standard), 1-90 (Premium)
```

### Throughput Units vs Processing Units

**Throughput Units (Basic/Standard)**:

- Shared capacity (multi-tenant)
- Pre-purchased capacity blocks
- 1 TU = 1 MB/s ingress, 2 MB/s egress
- Manual scaling (Basic) or auto-inflate (Standard)
- Range: 1-20 TUs

**Processing Units (Premium)**:

- Dedicated capacity (single-tenant)
- Isolated compute resources
- 1 PU ≈ 50 MB/s ingress, 100 MB/s egress
- Self-serve scaling (scale up/down)
- Range: 1-16 PUs

### Auto-Inflate Configuration

Available in **Standard** and **Premium** tiers only:

```yaml
# Start with 2 TUs, automatically scale up to 10 TUs when traffic increases
eventHubSkuCapacity: "2" # Starting capacity
eventHubMaxThroughputUnits: "10" # Maximum capacity
```

**How it works**:

- Monitors traffic levels
- Automatically adds TUs/PUs when ingress/egress exceeds 80% capacity
- Automatically removes TUs/PUs when traffic decreases
- You pay only for actual TUs/PUs used each hour

**Basic tier** requires manual scaling (redeploy with new capacity).

### Partition Configuration

```yaml
# More partitions = more parallelism, but more overhead
eventHubPartitions: "8" # Options: 1-32 (Basic/Standard), 1-100 (Premium)
```

**Choosing partition count**:

- **POC/Dev**: 4-8 partitions (matches default consumer parallelism)
- **Small Production**: 8-16 partitions
- **Large Production**: 16-32 partitions
- **Enterprise**: 32-100 partitions (Premium only)

**Important**: Partitions cannot be changed after creation. Choose wisely!

### Message Retention Configuration

```yaml
# How long messages are stored before deletion
eventHubMessageRetention: "7" # Days
```

**Retention limits by tier**:

- **Basic**: 1 day (fixed)
- **Standard**: 1-7 days
- **Premium**: 1-90 days

**Note**: Longer retention = higher storage costs (included in tier pricing).

---

## Connection Details

Event Hubs provides **Kafka-compatible** connections, so standard Kafka clients work without modification.

### Kubernetes Secret Format

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sn-mds-redpanda-config
  namespace: boreal-system
stringData:
  uses-cloud-service: "true"
  broker: <namespace>.servicebus.windows.net:9093
  sasl-mechanism: PLAIN
  security-protocol: SASL_SSL
  sasl-admin-username: "$ConnectionString"
  sasl-admin-password: <connection-string>
  replication-factor: "3"
  message-timeout-ms: "30000"
```

### Kafka Client Configuration

**Connection String Format**:

```
<namespace>.servicebus.windows.net:9093
```

**Authentication**:

- **Protocol**: SASL_SSL (SASL over TLS)
- **Mechanism**: PLAIN
- **Username**: `$ConnectionString` (literal string)
- **Password**: Full Event Hubs connection string

**Compatible with**:

- ✅ Apache Kafka clients (Java, Python, Go, Node.js, etc.)
- ✅ Kafka Connect
- ✅ Kafka Streams
- ✅ Confluent clients
- ✅ Spring Kafka
- ✅ Redpanda clients

---

## Configuration Examples

### Example 1: Minimal Dev/Test (~$11/mo)

```yaml
eventHubSkuName: Basic
eventHubSkuTier: Basic
eventHubSkuCapacity: "1" # 1 TU, 1 MB/s ingress
eventHubMaxThroughputUnits: "1" # No auto-inflate on Basic
eventHubPartitions: "4"
eventHubMessageRetention: "1" # Fixed 1 day
```

**Use for**: Local development, testing, demos

### Example 2: Standard POC (~$45/mo) ⭐ DEFAULT

```yaml
eventHubSkuName: Standard
eventHubSkuTier: Standard
eventHubSkuCapacity: "2" # 2 TUs, 2 MB/s ingress
eventHubMaxThroughputUnits: "10" # Auto-scale to 10 TUs if needed
eventHubPartitions: "8"
eventHubMessageRetention: "7" # Max retention for Standard
```

**Use for**: POCs, MVPs, staging environments

### Example 3: Small Production (~$225/mo)

```yaml
eventHubSkuName: Standard
eventHubSkuTier: Standard
eventHubSkuCapacity: "10" # 10 TUs, 10 MB/s ingress
eventHubMaxThroughputUnits: "20" # Can scale to max
eventHubPartitions: "16"
eventHubMessageRetention: "7"
```

**Use for**: Small production workloads, predictable traffic

### Example 4: Medium Production (~$450/mo)

```yaml
eventHubSkuName: Standard
eventHubSkuTier: Standard
eventHubSkuCapacity: "20" # 20 TUs, 20 MB/s ingress (max)
eventHubMaxThroughputUnits: "20" # Already at max
eventHubPartitions: "32" # Max partitions
eventHubMessageRetention: "7"
```

**Use for**: Medium production, reaching Standard tier limits

### Example 5: High-Performance Production (~$1,800/mo)

```yaml
eventHubSkuName: Premium
eventHubSkuTier: Premium
eventHubSkuCapacity: "2" # 2 PUs, ~100 MB/s ingress
eventHubMaxThroughputUnits: "4" # Can scale to 4 PUs
eventHubPartitions: "32"
eventHubMessageRetention: "30" # 30-day retention
```

**Use for**: High-traffic production, dedicated capacity needed

### Example 6: Enterprise Production (~$3,600/mo)

```yaml
eventHubSkuName: Premium
eventHubSkuTier: Premium
eventHubSkuCapacity: "4" # 4 PUs, ~200 MB/s ingress
eventHubMaxThroughputUnits: "8" # Can scale to 8 PUs
eventHubPartitions: "64"
eventHubMessageRetention: "90" # Max retention (compliance)
```

**Use for**: Mission-critical workloads, compliance requirements

---

## Migration & Upgrade Paths

### Path 1: POC → Production (Stay on Standard)

1. **Start**: Standard 2 TUs (~$45/mo)
2. **Scale**: Standard 5-10 TUs (~$113-$225/mo)
3. **Max**: Standard 20 TUs (~$450/mo)

**When to migrate to Premium**: When you need >20 MB/s or dedicated capacity.

### Path 2: Standard → Premium (Dedicated Capacity)

1. **Start**: Standard 20 TUs (~$450/mo, max capacity)
2. **Evaluate**: Monitor performance, identify capacity constraints
3. **Upgrade**: Premium 2 PUs (~$1,800/mo, 5x throughput)
4. **Scale**: Add more PUs as needed

### Path 3: Direct to Premium

1. **Start**: Premium 2-4 PUs (~$1,800-$3,600/mo)
2. **Scale**: Auto-scale or manually add PUs

**Best for**: High-traffic from day one, mission-critical workloads

### How to Switch Tiers

Update `Pulumi.byoc-services.yaml` and redeploy:

```bash
# Edit the config file
vim Pulumi.byoc-services.yaml

# Change tier settings
# From: eventHubSkuName: Standard
# To:   eventHubSkuName: Premium

# Redeploy
cd pulumi/azure/managed-redis-managed-event-bus-temporal-clickhouse
pulumi up
```

**Important**:

- Changing tiers requires replacing the namespace
- Messages are NOT automatically migrated
- Plan for a migration window or dual-write pattern
- Partition count cannot be changed (must recreate Event Hub)

---

## Cost Optimization Tips

1. **Right-Size Your Capacity**
   - Start with Standard 2 TUs for POCs (~$45/mo)
   - Enable auto-inflate to handle traffic spikes
   - Monitor actual throughput before over-provisioning

2. **Use Basic Tier for Dev/Test**
   - Basic 1 TU is $11/mo vs $22/mo for Standard
   - Perfect for development environments
   - Switch to Standard for POCs (need longer retention)

3. **Optimize Partition Count**
   - Don't over-partition (overhead per partition)
   - Start with 8 partitions, increase if needed
   - Premium allows up to 100 partitions

4. **Adjust Retention Based on Needs**
   - Standard: Use 1-3 days unless replay needed
   - Premium: Use 7-30 days for compliance
   - Longer retention = higher storage costs

5. **Consider Reserved Capacity**
   - 1-year commitment saves ~20%
   - 3-year commitment saves ~40%
   - Only for stable production workloads

6. **Use Capture for Long-Term Storage**
   - Archive to Azure Storage (~$0.02/GB/mo)
   - Cheaper than Event Hubs retention
   - Use Event Hubs for real-time, Storage for historical

7. **Monitor and Adjust Auto-Inflate**
   - Set `maxThroughputUnits` to prevent cost surprises
   - Review Azure Monitor metrics weekly
   - Adjust base capacity based on patterns

8. **Batch Messages**
   - Combine small messages to reduce overhead
   - Use Kafka batching features
   - Reduces cost per event

---

## When to Choose Each Tier

### Choose Basic Tier When:

✅ **Development and testing** (non-production)  
✅ **Budget is extremely tight** (<$50/mo)  
✅ **Single consumer application**  
✅ **1-day retention is sufficient**  
✅ **Manual scaling is acceptable**

**Limitations**:

- ❌ No auto-inflate (manual scaling only)
- ❌ Only 1 consumer group
- ❌ Fixed 1-day retention
- ❌ No capture to storage
- ❌ Lower SLA (99.95%)

### Choose Standard Tier When: ⭐ RECOMMENDED FOR MOST

✅ **POCs and MVPs** (cost-effective)  
✅ **Small to medium production** (<20 MB/s)  
✅ **Multiple consumer applications** (up to 20 groups)  
✅ **Need 1-7 day retention**  
✅ **Auto-inflate for traffic spikes**  
✅ **Standard Kafka features sufficient**

**Best Value**: Standard 2-10 TUs with auto-inflate covers most use cases.

### Choose Premium Tier When:

✅ **High-traffic production** (>20 MB/s throughput)  
✅ **Need consistent performance** (no noisy neighbors)  
✅ **Mission-critical workloads** (99.99% SLA)  
✅ **Long retention required** (30-90 days)  
✅ **Many microservices** (up to 1000 consumer groups)  
✅ **Compliance requirements** (VNet isolation, customer-managed keys)  
✅ **Predictable latency** (dedicated capacity)

**Tradeoffs**:

- 💰 3-15x higher cost vs Standard
- 🔧 Requires capacity planning
- 📊 Overkill for low-traffic workloads

### Choose Dedicated Tier When:

✅ **Ultra-high throughput** (>200 MB/s ingress)  
✅ **Maximum performance** (lowest latency requirements)  
✅ **Extreme scale** (highest capacity needs)  
✅ **All Premium features** plus maximum throughput  
✅ **Mission-critical** with highest performance demands

**Tradeoffs**:

- 💰 Highest cost tier (~$5,000/CU per month)
- 🔧 Requires significant capacity planning
- 📊 Only for extreme performance requirements

---

## Technical Specifications

### Kafka Compatibility

Event Hubs supports **Kafka protocol 1.0+**:

| Feature                | Supported  | Notes                                    |
| ---------------------- | ---------- | ---------------------------------------- |
| **Kafka Producer API** | ✅ Yes     | Full support                             |
| **Kafka Consumer API** | ✅ Yes     | Full support                             |
| **Kafka Connect**      | ✅ Yes     | Connectors work without modification     |
| **Kafka Streams**      | ✅ Yes     | Stateful/stateless processing            |
| **Schema Registry**    | ✅ Yes     | Premium tier only (Confluent-compatible) |
| **Transactions**       | ⚠️ Limited | Idempotent producer supported            |
| **Exactly-once**       | ⚠️ Limited | Idempotent semantics, not full EOS       |

### Protocol Details

**Connection**:

- Endpoint: `<namespace>.servicebus.windows.net:9093`
- Protocol: Kafka wire protocol over TLS 1.2
- Authentication: SASL_SSL with PLAIN mechanism

**Compatibility**:

- Apache Kafka 1.0+
- Confluent Platform 4.0+
- All major Kafka client libraries

### Performance Characteristics

| Tier     | Latency (p99) | Max Message Size | Max Batch Size | Max Event Rate         |
| -------- | ------------- | ---------------- | -------------- | ---------------------- |
| Basic    | <50ms         | 1 MB             | 1 MB           | 1,000/sec per TU       |
| Standard | <50ms         | 1 MB             | 1 MB           | 1,000/sec per TU       |
| Premium  | <10ms         | 1 MB             | 1 MB           | **50,000+/sec per PU** |

**Note**: Premium provides **10x lower latency** and **50x higher throughput** per unit.

### Security Features

| Feature                         | Basic | Standard | Premium |
| ------------------------------- | ----- | -------- | ------- |
| **TLS Encryption**              | ✅    | ✅       | ✅      |
| **Shared Access Signature**     | ✅    | ✅       | ✅      |
| **Azure AD Authentication**     | ❌    | ✅       | ✅      |
| **IP Firewall**                 | ❌    | ✅       | ✅      |
| **VNet Service Endpoints**      | ❌    | ✅       | ✅      |
| **Private Link**                | ❌    | ❌       | ✅      |
| **Customer-Managed Keys (CMK)** | ❌    | ❌       | ✅      |
| **Azure Policy**                | ❌    | ✅       | ✅      |

---

## Additional Resources

- [Azure Event Hubs Pricing](https://azure.microsoft.com/pricing/details/event-hubs/)
- [Event Hubs Documentation](https://learn.microsoft.com/azure/event-hubs/)
- [Kafka on Event Hubs Guide](https://learn.microsoft.com/azure/event-hubs/event-hubs-for-kafka-ecosystem-overview)
- [Event Hubs Quotas and Limits](https://learn.microsoft.com/azure/event-hubs/event-hubs-quotas)
- [Kafka Client Libraries](https://cwiki.apache.org/confluence/display/KAFKA/Clients)
- [Performance Tuning Guide](https://learn.microsoft.com/azure/event-hubs/event-hubs-scalability)

---

## Summary

✅ **Default Setup**: Standard 2 TUs (~$45/mo) - Perfect for POCs and small production  
✅ **Scale Up**: Standard auto-inflate handles traffic spikes automatically  
✅ **Production**: Standard 10-20 TUs for most workloads  
✅ **Enterprise**: Premium (~$900/PU) for >20 MB/s, dedicated capacity, or 99.99% SLA  
✅ **Ultra-High Performance**: Dedicated (~$5,000/CU) for maximum throughput requirements  
✅ **Kafka-Compatible**: Use standard Kafka clients without code changes  
✅ **Easy Configuration**: All settings in `Pulumi.byoc-services.yaml`
