import * as eks from "@pulumi/eks";
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { getKubeconfig } from "./utils/kubeconfig";
import { installRedis } from "./resources/redis";
import { installKafka } from "./resources/kafka";
import { installTemporal } from "./resources/temporal";
import { installClickhouse } from "./resources/clickhouse";

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
export async function main() {
  const commonTags = {
    Cloud: "aws",
    Environment: "byoc-testing",
    Project: "BYOC-Example_AWS-Redis-Kafka-Temporal-Clickhouse",
  };

  // Reference the base stack to get the EKS cluster
  const baseStack = new pulumi.StackReference("base", {
    name: `514labs/BYOC-Example_AWS-Redis-Kafka-Temporal-Clickhouse/base`,
  });

  const eksCluster = baseStack.getOutput("eksCluster") as unknown as eks.Cluster;
  const kubeconfig = await getKubeconfig(eksCluster);

  // Create a Kubernetes provider using the EKS cluster's kubeconfig
  const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: kubeconfig,
  });

  const releaseOpts = {
    provider: k8sProvider,
  };

  await installRedis(releaseOpts);
  await installKafka(releaseOpts);
  await installTemporal(releaseOpts);
  await installClickhouse(releaseOpts);
}

const outputs = main();
