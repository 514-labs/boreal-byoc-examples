import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";

export interface EksClusterArgs {
  clusterName: string;
  vpc: aws.ec2.Vpc;
  privateSubnetIds: pulumi.Output<string>[];
  publicEndpointEnabled: boolean;
  commonTags: { [key: string]: pulumi.Input<string> };
}

/**
 * Creates an EKS cluster
 *
 * When first deploying this EKS Cluster, we must have the public endpoint enabled.
 * This allows us to install the tailscale kubernetes operator and resources required to
 * manage the kubernetes cluster securely.
 *
 * @param args - The arguments for the EKS cluster
 * @param args.clusterName - The name of the EKS cluster
 * @param args.vpc - The VPC to create the EKS cluster in
 * @param args.privateSubnetIds - The private subnet IDs to create the EKS cluster in
 * @param args.publicEndpointEnabled - Whether to enable the public endpoint for the EKS cluster
 * @param args.commonTags - The common tags to apply to the EKS cluster
 * @returns The EKS cluster resource
 */
export async function createEksCluster(args: EksClusterArgs) {
  const cluster = new eks.Cluster("eks-auto-mode", {
    name: args.clusterName,
    vpcId: args.vpc.id,
    nodeAssociatePublicIpAddress: false,
    privateSubnetIds: args.privateSubnetIds,
    // EKS Auto Mode requires Access Entries, use either the `Api` or `ApiAndConfigMap` authentication mode.
    authenticationMode: eks.AuthenticationMode.Api,

    // Enables compute, storage and load balancing for the cluster.
    autoMode: {
      enabled: true,
    },

    endpointPrivateAccess: false,
    endpointPublicAccess: args.publicEndpointEnabled,

    tags: {
      Name: args.clusterName,
      ...args.commonTags,
    },

    nodeSecurityGroupTags: {
      Name: `${args.clusterName}-node-sg`,
      ...args.commonTags,
    },
  });

  return cluster;
}
