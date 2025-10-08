import { Buffer } from "node:buffer";
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as azure from "@pulumi/azure-native";

import { deployAksCluster } from "./resources/aks";
import { makeClusterPrivate } from "./resources/aks/aks-cli-install";
import { createJumpBox } from "./resources/jump-box";
import { createNetwork } from "./resources/base-vpc/network";
import { installTailscaleOperator } from "./resources/tailscale";
import { installGatewayApiCrds } from "./resources/gateway-crds";
import { defaultVNetSubnetCIDRSplit, defaultAksServiceNetworkCIDRs } from "./utils/cidr";

async function main() {
  const stackName = pulumi.getStack();
  const projectName = pulumi.getProject();

  const config = new pulumi.Config();
  /// Azure Configuration
  // Default to centralus which supports availability zones (required for AKS Automatic)
  const name = config.get("name") || "boreal-byoc";
  const location = config.get("azure-native:location") || "centralus";
  /// VNet Configuration
  const vnetCidrBlock = config.require("aksVnetCidrBlock");
  const { privateSubnetCidr, publicSubnetCidr, isolatedSubnetCidr, apiServerSubnetCidr } =
    defaultVNetSubnetCIDRSplit(vnetCidrBlock);
  const privateSubnetNsgRules = JSON.parse(
    config.require("privateSubnetNsgRules")
  ) as azure.types.input.network.SecurityRuleArgs[];
  const publicSubnetNsgRules = JSON.parse(
    config.require("publicSubnetNsgRules")
  ) as azure.types.input.network.SecurityRuleArgs[];
  const isolatedSubnetNsgRules = JSON.parse(
    config.require("isolatedSubnetNsgRules")
  ) as azure.types.input.network.SecurityRuleArgs[];
  const apiServerSubnetNsgRules = JSON.parse(
    config.require("apiServerSubnetNsgRules")
  ) as azure.types.input.network.SecurityRuleArgs[];
  /// AKS Configuration
  const adminGroupObjectIds = JSON.parse(config.require("aksAdminGroupObjectIds")) as string[];
  const aksClusterImported = config.getBoolean("aksClusterImported") || true;
  const { aksServiceCidr, aksDnsServiceIP } = defaultAksServiceNetworkCIDRs(vnetCidrBlock);
  const aksNodeVmSize = config.get("aksNodeVmSize");
  const enablePrivateCluster = config.getBoolean("enablePrivateCluster") || false;
  /// Jumpbox Configuration
  const jumpboxEnabled = config.getBoolean("jumpboxEnabled") || false;
  const jumpboxName = config.get("jumpboxName") || "boreal-jump-box";
  const jumpboxInstanceType = config.get("jumpboxInstanceType") || "Standard_DS2_v2";
  const jumpboxAdminUsername = config.get("jumpboxAdminUsername") || "ubuntu";
  const jumpboxSshPublicKey = jumpboxEnabled ? config.require("jumpboxSshPublicKey") : "";
  const jumpboxTailscaleAuthKey = jumpboxEnabled
    ? config.requireSecret("tailscaleAuthKey")
    : pulumi.secret("");
  /// Tailscale Configuration
  const tailscaleClientId = config.getSecret("tailscaleClientId");
  const tailscaleClientSecret = config.getSecret("tailscaleClientSecret");
  const tailscaleK8sOperatorDefaultTags = config.get("tailscaleK8sOperatorDefaultTags") || "";

  // Get common tags from configuration and add the dynamic Project tag
  const commonTags: { [k: string]: string } = {
    Cloud: config.require("tagCloud"),
    Environment: config.require("tagEnvironment"),
    Project: projectName,
    Stack: stackName,
  };

  // Create short name for resources (trimmed from left to keep stack-specific parts)
  const shortName = createShortResourceGroupName(name);
  // Create resource group first
  const resourceGroup = new azure.resources.ResourceGroup("rg", {
    resourceGroupName: shortName,
    location: location,
    tags: commonTags,
  });

  // Create network with NSGs and NAT Gateway
  const { vnet, privateSubnet, publicSubnet, isolatedSubnet, apiServerSubnet } =
    await createNetwork({
      resourceGroupName: resourceGroup.name,
      vnetName: shortName,
      location,
      commonTags,
      vnetCidr: vnetCidrBlock,
      privateSubnet: {
        cidr: privateSubnetCidr,
        nsgRules: privateSubnetNsgRules,
      },
      publicSubnet: {
        cidr: publicSubnetCidr,
        nsgRules: publicSubnetNsgRules,
      },
      isolatedSubnet: {
        cidr: isolatedSubnetCidr,
        nsgRules: isolatedSubnetNsgRules,
      },
      apiServerSubnet: {
        cidr: apiServerSubnetCidr,
        nsgRules: apiServerSubnetNsgRules,
      },
    });

  const { aksCluster, clusterId } = await deployAksCluster({
    clusterName: shortName,
    resourceGroupName: resourceGroup.name,
    location,
    vnetId: vnet.id,
    subnetId: privateSubnet.id,
    apiServerSubnetId: apiServerSubnet.id,
    serviceCidr: aksServiceCidr,
    dnsServiceIP: aksDnsServiceIP,
    adminGroupObjectIds,
    commonTags,
    nodeVmSize: aksNodeVmSize,
  });

  // Note: Cluster admin access is granted via Engineering group (bd7d7362-4096-450a-86ab-48bb6c0a4bed)
  // which is configured as an adminGroupObjectID via az aks create command
  // All Engineering group members automatically have cluster-admin permissions

  // Wait for cluster creation to complete, then get kubeconfig
  // We use pulumi.all() to ensure the cluster exists before calling the Azure API
  const kubeconfig = pulumi.all([clusterId, resourceGroup.name]).apply(([id, rgName]) => {
    // Cluster is now created, safe to call the API
    const creds = azure.containerservice.listManagedClusterUserCredentialsOutput({
      resourceGroupName: rgName,
      resourceName: shortName,
    });

    return creds.kubeconfigs[0].value.apply((v: string) => Buffer.from(v, "base64").toString());
  });

  const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: kubeconfig,
    enableServerSideApply: true,
  });

  const releaseOpts = {
    provider: k8sProvider,
  };

  const borealNamespace = new k8s.core.v1.Namespace(
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

  await installGatewayApiCrds(k8sProvider);
  // await createManagedCsiStorageClass(k8sProvider, [aksCluster]);

  // Tailscale disabled - AKS Automatic Gatekeeper policy requires health probes
  // To enable: configure livenessProbe and readinessProbe in Tailscale helm values
  if (tailscaleClientId && tailscaleClientSecret) {
    await installTailscaleOperator(
      tailscaleClientId,
      tailscaleClientSecret,
      tailscaleK8sOperatorDefaultTags,
      releaseOpts,
      pulumi.interpolate`azure-${name}-tailscale-operator-${location}`
    );
  }

  if (jumpboxEnabled) {
    await createJumpBox({
      resourceGroupName: resourceGroup.name,
      subnetId: privateSubnet.id,
      location,
      commonTags: commonTags,
      vmName: jumpboxName,
      vmSize: jumpboxInstanceType,
      adminUsername: jumpboxAdminUsername,
      sshPublicKey: jumpboxSshPublicKey,
      tailscaleAuthKey: jumpboxTailscaleAuthKey,
    });
  }

  // Make cluster private AFTER all Kubernetes resources are installed
  // This ensures Pulumi can connect to install resources before the API server becomes private
  if (enablePrivateCluster) {
    makeClusterPrivate(
      {
        clusterName: shortName,
        resourceGroupName: resourceGroup.name,
        location,
        vnetId: vnet.id,
        subnetId: privateSubnet.id,
        apiServerSubnetId: apiServerSubnet.id,
        serviceCidr: aksServiceCidr,
        dnsServiceIP: aksDnsServiceIP,
        adminGroupObjectIds,
        commonTags,
        nodeVmSize: aksNodeVmSize,
        enablePrivateCluster,
      },
      aksCluster,
      borealNamespace
    );
  }
  return {
    resourceGroupName: resourceGroup.name,
    aksClusterName: shortName,
    kubeconfig,
    privateSubnetId: privateSubnet.id,
    publicSubnetId: publicSubnet.id,
    isolatedSubnetId: isolatedSubnet.id,
    apiServerSubnetId: apiServerSubnet.id,
    nodeResourceGroup: `${shortName}-nodes`,
  };
}

function createShortResourceGroupName(name: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

  const normalized = normalize(name);
  const maxLength = 60;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  // Split the maxLength evenly between start and end
  // If odd number, give remainder to the right (end gets more)
  const leftHalf = Math.floor(maxLength / 2);
  const rightHalf = maxLength - leftHalf;

  const start = normalized.slice(0, leftHalf);
  const end = normalized.slice(-rightHalf);

  return `${start}${end}`;
}

// Don't run main() here - it will be called from the parent index.ts
// Export only the main function
export { main };
