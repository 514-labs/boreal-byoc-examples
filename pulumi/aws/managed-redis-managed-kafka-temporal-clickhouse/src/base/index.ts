import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createEksCluster } from "./resources/eks";
import { createVpc } from "./resources/base-vpc/vpc";
import { createJumpBox } from "./resources/jump-box";
import { installTailscaleOperator } from "./resources/tailscale";
import { createGp3StorageClass } from "./resources/storage-class-gp3";
import { getKubeconfig } from "./utils/kubeconfig";
import { installGatewayApiCrds } from "./resources/gateway-crds";
import { installCertManager } from "./resources/cert-manager";
import { deployOtelCollectorOperator } from "./resources/otel";

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

  const k8sVersion = "1.32";
  const config = new pulumi.Config();
  /// AWS Configuration
  // const awsRegion = config.require("aws:region");
  const awsProfile = config.require("awsProfile");
  /// VPC Configuration
  const vpcCidrBlock = config.require("vpcCidrBlock");
  /// Jumpbox Configuration
  const jumpboxEnabled = config.requireBoolean("jumpboxEnabled");
  const jumpboxName = config.require("jumpboxName");
  const jumpboxInstanceType = config.require("jumpboxInstanceType");
  const jumpboxTailscaleAuthKey = config.requireSecret("tailscaleAuthKey"); // From ESC environment
  /// EKS Configuration
  const eksClusterName = config.require("eksClusterName");
  const eksPrivateEndpointEnabled = config.requireBoolean("eksPrivateEndpointEnabled");
  const eksPublicEndpointEnabled = config.requireBoolean("eksPublicEndpointEnabled");
  const tailscaleClientId = config.requireSecret("tailscaleClientId"); // From ESC environment
  const tailscaleClientSecret = config.requireSecret("tailscaleClientSecret"); // From ESC environment
  const tailscaleK8sOperatorDefaultTags = config.require("tailscaleK8sOperatorDefaultTags"); // From ESC environment
  const tailscaleK8sProxiesDefaultTags = config.require("tailscaleK8sProxiesDefaultTags"); // From ESC environment
  const tailscaleOperatorHostname = config.require("tailscaleOperatorHostname");
  const createTailscaleSubnetRouter = config.getBoolean("createTailscaleSubnetRouter") ?? false;
  const tailscaleSubnetRouterName = config.require("tailscaleSubnetRouterName");

  // Get common tags from configuration and add the dynamic Project tag
  const commonTags = {
    Cloud: config.require("tagCloud"),
    Environment: config.require("tagEnvironment"),
    Project: projectName,
    Stack: stackName,
  };

  const { vpc, azNames, publicSubnets, privateSubnets, isolatedSubnets } = await createVpc({
    cidrBlock: vpcCidrBlock,
    commonTags: commonTags,
  });

  if (jumpboxEnabled) {
    await createJumpBox(
      vpc,
      privateSubnets,
      commonTags,
      jumpboxName,
      jumpboxInstanceType,
      jumpboxTailscaleAuthKey,
      k8sVersion
    );
  }

  const eksCluster = await createEksCluster({
    vpc: vpc,
    clusterName: eksClusterName,
    privateSubnetIds: privateSubnets.map((subnet) => subnet.id),
    privateEndpointEnabled: eksPrivateEndpointEnabled,
    publicEndpointEnabled: eksPublicEndpointEnabled,
    commonTags: commonTags,
    k8sVersion: k8sVersion,
  });

  const kubeconfig = await getKubeconfig(eksCluster, awsProfile);

  // Create a Kubernetes provider using the appropriate kubeconfig
  const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: kubeconfig,
  });

  const releaseOpts = {
    provider: k8sProvider,
  };

  new k8s.core.v1.Namespace(
    "boreal-system",
    {
      metadata: {
        name: "boreal-system",
      },
    },
    {
      ...releaseOpts,
    }
  );

  await installGatewayApiCrds(releaseOpts);
  await installTailscaleOperator(
    tailscaleClientId,
    tailscaleClientSecret,
    tailscaleK8sOperatorDefaultTags,
    tailscaleK8sProxiesDefaultTags,
    tailscaleOperatorHostname,
    tailscaleSubnetRouterName,
    vpcCidrBlock,
    createTailscaleSubnetRouter,
    releaseOpts
  );

  // Install cert-manager and OpenTelemetry operator
  const certManager = await installCertManager(releaseOpts);
  await deployOtelCollectorOperator("boreal-system", releaseOpts, certManager);

  // Create gp3 storage class for better performance with EBS volumes
  const gp3StorageClass = await createGp3StorageClass(eksCluster, k8sProvider);

  return {
    vpc,
    publicSubnets,
    isolatedSubnets,
    privateSubnets,
    eksCluster,
    gp3StorageClass,
  };
}

// Don't run main() here - it will be called from the parent index.ts
// Export only the main function
export { main };
