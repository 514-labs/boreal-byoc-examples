import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { createElastiCacheRedis } from "./resources/redis";
import { createMSKCluster } from "./resources/kafka";
import { installTemporal } from "./resources/temporal";
import { deployClickhouse } from "./resources/clickhouse";

/**
 * This function is the main function that will be called when the program is run.
 * It will create the VPC, the subnets, and the routing tables.
 * It will also create the NAT Gateways and the Elastic IPs.
 * 3 subnets are created for each type: public, isolated, and private.
 * 3 availability zones are used.
 * The VPC and various resources will be tagged with the following tags:
 * - Cloud: aws
 * - Environment: prod
 * - Project: boreal
 */
async function main() {
  const stackName = pulumi.getStack();
  const projectName = pulumi.getProject();

  const config = new pulumi.Config();
  const redisPort = config.require("redisPort");
  const redisNodeType = config.require("redisNodeType");
  const redisSnapshotWindow = config.require("redisSnapshotWindow");
  const redisMaintenanceWindow = config.require("redisMaintenanceWindow");
  const redisNumCacheNodes = parseInt(config.require("redisNumCacheNodes"));
  const redisAutomaticFailoverEnabled = config.requireBoolean("redisAutomaticFailoverEnabled");
  const redisSnapshotRetentionLimit = parseInt(config.require("redisSnapshotRetentionLimit"));

  const kafkaInstanceType = config.require("kafkaInstanceType");
  const kafkaEbsVolumeSize = parseInt(config.require("kafkaEbsVolumeSize"));
  const kafkaNumberOfBrokerNodes = parseInt(config.require("kafkaNumberOfBrokerNodes"));

  const temporalReplicas = parseInt(config.require("temporalReplicas"));
  const temporalCassandraReplicas = parseInt(config.require("temporalCassandraReplicas"));
  const temporalElasticsearchReplicas = parseInt(config.require("temporalElasticsearchReplicas"));
  const temporalNamespaceRetention = parseInt(config.require("temporalNamespaceRetention"));
  const temporalCassandraStorageSize = config.get("temporalCassandraStorageSize") ?? "50Gi";
  const temporalElasticsearchStorageSize =
    config.get("temporalElasticsearchStorageSize") ?? "100Gi";

  const clickhouseShards = parseInt(config.require("clickhouseShards"));
  const clickhouseStorageSize = config.require("clickhouseStorageSize");
  const clickhouseReplicas = parseInt(config.require("clickhouseReplicas"));
  const clickhouseRequestedCpu = config.require("clickhouseRequestedCpu");
  const clickhouseLimitCpu = config.get("clickhouseLimitCpu") || clickhouseRequestedCpu;
  const clickhouseRequestedMemory = config.require("clickhouseRequestedMemory");
  const clickhouseLimitMemory = config.get("clickhouseLimitMemory") || clickhouseRequestedMemory;

  // Get org ID for tags
  const orgId = config.require("orgId");

  // Get common tags from configuration and add the dynamic Project tag
  const commonTags = {
    Cloud: config.require("tagCloud"),
    Environment: config.require("tagEnvironment"),
    Project: projectName,
    Stack: stackName,
    OrgId: orgId,
  };

  // Reference the base stack to get the EKS cluster and VPC resources
  const baseStack = new pulumi.StackReference("base", {
    name: `514labs/${projectName}/base`,
  });

  const vpcOutput = baseStack.getOutput("vpc") as pulumi.Output<aws.ec2.Vpc>;
  const kubeconfigOutput = baseStack.getOutput("kubeconfig") as pulumi.Output<string>;
  const eksSecurityGroupIdOutput = baseStack.getOutput(
    "eksSecurityGroupId"
  ) as pulumi.Output<string>;
  const privateSubnetsOutput = baseStack.getOutput("privateSubnets") as pulumi.Output<
    aws.ec2.Subnet[]
  >;
  const eksClusterNameOutput = baseStack.getOutput("eksClusterName") as pulumi.Output<string>;
  const eksOidcProviderArnOutput = baseStack.getOutput(
    "eksOidcProviderArn"
  ) as pulumi.Output<string>;

  // Apply all outputs together to resolve them
  return pulumi
    .all([
      vpcOutput,
      privateSubnetsOutput,
      kubeconfigOutput,
      eksSecurityGroupIdOutput,
      eksClusterNameOutput,
      eksOidcProviderArnOutput,
    ])
    .apply(
      async ([
        vpc,
        privateSubnets,
        kubeconfig,
        eksSecurityGroupId,
        eksClusterName,
        eksOidcProviderArn,
      ]) => {
        // Create a Kubernetes provider using the EKS cluster's kubeconfig
        const k8sProvider = new k8s.Provider("k8s-provider", {
          kubeconfig: kubeconfig,
        });

        const releaseOpts = {
          provider: k8sProvider,
        };

        // Create ElastiCache Redis instead of installing Redis via Helm
        await createElastiCacheRedis({
          vpc: vpc,
          privateSubnetIds: privateSubnets.map((subnet) => subnet.id),
          k8sProvider: k8sProvider,
          eksSecurityGroupId: eksSecurityGroupId,
          commonTags: commonTags,
          redisNodeType: redisNodeType,
          redisNumCacheNodes: redisNumCacheNodes,
          redisPort: parseInt(redisPort),
          redisMaintenanceWindow: redisMaintenanceWindow,
          redisSnapshotWindow: redisSnapshotWindow,
          redisSnapshotRetentionLimit: redisSnapshotRetentionLimit,
          automaticFailoverEnabled: redisAutomaticFailoverEnabled,
        });

        // Create MSK cluster instead of installing Kafka via Helm
        await createMSKCluster({
          vpc: vpc,
          privateSubnetIds: privateSubnets.map((subnet) => subnet.id),
          k8sProvider: k8sProvider,
          eksSecurityGroupId: eksSecurityGroupId,
          commonTags: commonTags,
          kafkaInstanceType: kafkaInstanceType,
          kafkaEbsVolumeSize: kafkaEbsVolumeSize,
          kafkaNumberOfBrokerNodes: kafkaNumberOfBrokerNodes,
        });

        await installTemporal({
          serverReplicas: temporalReplicas,
          cassandraReplicas: temporalCassandraReplicas,
          elasticsearchReplicas: temporalElasticsearchReplicas,
          namespaceRetention: temporalNamespaceRetention,
          cassandraStorageSize: temporalCassandraStorageSize,
          elasticsearchStorageSize: temporalElasticsearchStorageSize,
          releaseOpts: releaseOpts,
        });

        await deployClickhouse({
          helmArgs: {
            namespace: "byoc-clickhouse",
            clickhouseShards,
            clickhouseReplicas,
            clickhouseStorageSize,
            cpuRequest: clickhouseRequestedCpu,
            cpuLimit: clickhouseLimitCpu,
            memoryRequest: clickhouseRequestedMemory,
            memoryLimit: clickhouseLimitMemory,
            releaseOpts: releaseOpts,
          },
        });
      }
    );
}

// Export only the main function
export { main };
