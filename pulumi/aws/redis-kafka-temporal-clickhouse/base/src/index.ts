import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { createEksCluster } from "./resources/eks";
import { createVpc } from "./resources/base-vpc/vpc";
import { createJumpBox } from "./resources/base-vpc/jump-box";
import { installTailscaleOperator } from "./resources/tailscale";
import { getKubeconfig } from "./utils/kubeconfig";

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
  const vpcCidrBlock = "10.192.0.0/16";

  const commonTags = {
    Cloud: "aws",
    Environment: "byoc-testing",
    Project: "BYOC-Example_AWS-Redis-Kafka-Temporal-Clickhouse",
  };

  const { vpc, azNames, publicSubnets, privateSubnets, isolatedSubnets } = await createVpc({
    cidrBlock: vpcCidrBlock,
    commonTags: commonTags,
  });

  await createJumpBox(vpc, privateSubnets, commonTags);

  const eksCluster = await createEksCluster({
    vpc: vpc,
    clusterName: "boreal-byoc-example-eks-cluster",
    privateSubnetIds: privateSubnets.map((subnet) => subnet.id),
    publicEndpointEnabled: true,
    commonTags: commonTags,
  });

  const kubeconfig = await getKubeconfig(eksCluster);

  // Create a Kubernetes provider using the EKS cluster's kubeconfig
  const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: kubeconfig,
  });

  const releaseOpts = {
    provider: k8sProvider,
  };

  new k8s.core.v1.Namespace("boreal-system", {
    metadata: {
      name: "boreal-system",
    },
  }, {
    ...releaseOpts,
  });

  await installTailscaleOperator(releaseOpts);

  return {
    vpc,
    publicSubnets,
    isolatedSubnets,
    privateSubnets,
    eksCluster,
  };
}

// Run the main function and create stack outputs
const outputs = main();
export const vpc = pulumi.output(outputs).apply((o) => o.vpc);
export const privateSubnets = pulumi.output(outputs).apply((o) => o.privateSubnets);
export const eksCluster = pulumi.output(outputs).apply((o) => o.eksCluster);
