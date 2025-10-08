import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

interface AksArgs {
  clusterName: string;
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  subnetId: pulumi.Input<string>;
  vnetId: pulumi.Input<string>;
  serviceCidr: string;
  dnsServiceIP: string;
  commonTags: { [k: string]: string };
  // Optional: allow specifying a VM size to satisfy regional quota constraints for AKS Automatic
  nodeVmSize?: pulumi.Input<string>;
}

interface AksIdentityArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  vnetId: pulumi.Input<string>;
  commonTags: { [k: string]: string };
}

/**
 * Creates an AKS cluster in Automatic mode
 *
 * AKS Automatic provides a managed experience similar to EKS Auto Mode and GKE Autopilot.
 * It automatically manages node provisioning, scaling, and cluster operations.
 *
 * **IMPORTANT**: AKS Automatic mode requires availability zones.
 * You must deploy to a region that supports availability zones such as:
 * - eastus2, westus2, westus3, centralus, northeurope, westeurope, etc.
 *
 * Regions WITHOUT availability zone support (like eastus) will fail with:
 * "Managed cluster 'Automatic' SKU should enable 'AvailabilityZones' feature"
 *
 * @param args - The arguments for the AKS cluster
 * @param args.clusterName - The name for the AKS cluster
 * @param args.resourceGroupName - The resource group to create the cluster in
 * @param args.location - The Azure region to deploy to (must support availability zones)
 * @param args.subnetId - The subnet ID for cluster nodes
 * @param args.vnetId - The VNet ID for network access permissions
 * @param args.serviceCidr - CIDR for Kubernetes service IPs (internal to cluster)
 * @param args.dnsServiceIP - IP address for the Kubernetes DNS service (must be within serviceCidr)
 * @param args.commonTags - Common tags to apply to resources
 * @param args.nodeVmSize - Optional VM size for nodes
 * @returns The AKS cluster resource
 */
export async function createAksCluster(args: AksArgs) {
  const config = new pulumi.Config();
  const adminGroupObjectIds = JSON.parse(config.require("aksAdminGroupObjectIds")) as string[];

  const aksCluster = new azure.containerservice.ManagedCluster("aks-automatic", {
    resourceName: args.clusterName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    dnsPrefix: createDnsSafePrefix(),
    nodeResourceGroup: createNodeResourceGroupName(args.clusterName),

    // AKS Automatic mode - fully managed like EKS Auto Mode and GKE Autopilot
    sku: {
      name: "Automatic",
      tier: "Standard",
    },

    // System-assigned identity (let AKS manage it)
    identity: {
      type: "SystemAssigned",
    },

    // Azure AD integration with Engineering group as cluster admin
    aadProfile: {
      managed: true,
      enableAzureRBAC: true,
      // Engineering group gets cluster-admin permissions
      adminGroupObjectIDs: adminGroupObjectIds,
    },

    // Let AKS manage the VNet (Automatic mode default)
    networkProfile: {
      networkPlugin: "azure",
      serviceCidr: args.serviceCidr,
      dnsServiceIP: args.dnsServiceIP,
      // AKS Automatic recommends managed NAT Gateway
      outboundType: "managedNATGateway",
    },

    // Automatic mode manages nodes
    agentPoolProfiles: [
      {
        name: "systempool",
        mode: "System",
        // No vnetSubnetID - let AKS Automatic manage the VNet
        osType: "Linux",
        vmSize: args.nodeVmSize,
        count: 3,
      },
    ],

    // Enable automatic upgrades
    autoUpgradeProfile: {
      upgradeChannel: "stable",
    },

    tags: args.commonTags,
  });

  return { aksCluster };
}

/**
 * Creates a user-assigned managed identity for AKS with Network Contributor role
 *
 * This is required when using custom VNets with AKS. The identity needs Network Contributor
 * permissions to manage network resources within the VNet.
 *
 * @param args - The arguments for creating the identity
 * @returns The managed identity and role assignment
 */
function createAksIdentityWithRole(args: AksIdentityArgs) {
  // Create a user-assigned managed identity for AKS
  // Required when using custom VNets
  const aksIdentity = new azure.managedidentity.UserAssignedIdentity("aks-identity", {
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    tags: args.commonTags,
  });

  // Grant the AKS identity Network Contributor role on the VNet
  // This allows AKS to manage network resources within the VNet
  // Role Definition ID: 4d97b98b-1d4f-4787-a291-c67834d212e7 = Network Contributor
  const networkContributorRole = new azure.authorization.RoleAssignment(
    "aks-vnet-network-contributor",
    {
      principalId: aksIdentity.principalId,
      principalType: "ServicePrincipal",
      roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/4d97b98b-1d4f-4787-a291-c67834d212e7`,
      scope: args.vnetId,
    }
  );

  return { aksIdentity, networkContributorRole };
}

/**
 * Creates a DNS-safe prefix for AKS cluster
 *
 * Azure requires DNS prefixes to be 1-54 characters, lowercase alphanumeric and hyphens only.
 * This function truncates long names and adds a hash suffix for uniqueness.
 *
 * @returns A DNS-compliant prefix string
 */
function createDnsSafePrefix(): pulumi.Output<string> {
  const projectStack = pulumi.interpolate`${pulumi.getProject()}-${pulumi.getStack()}`;

  return projectStack.apply((ps) => {
    // Create a simple hash for uniqueness
    const hash = ps.split("").reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);
    const hashStr = Math.abs(hash).toString(36).substring(0, 8);

    // Create a short, DNS-safe name
    const safeName = ps
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 40); // Leave room for hash

    return `${safeName}-${hashStr}`;
  });
}

/**
 * Creates a short resource group name for AKS node resources
 *
 * Azure auto-generates node resource groups as MC_{rgName}_{clusterName}_{location},
 * but this can exceed the 90-character limit. We provide a custom short name instead.
 * Adds "-nodes" suffix to differentiate from the main resource group.
 *
 * @param clusterName - The AKS cluster name
 * @returns A short resource group name (max 90 chars)
 */
function createNodeResourceGroupName(clusterName: pulumi.Input<string>): pulumi.Output<string> {
  const maxPerName = 90;

  return pulumi.output(clusterName).apply((clusterName) => {
    const normalizedClusterName = clusterName.toLowerCase();
    const suffix = "-nodes";

    // Truncate the cluster name to leave room for suffix
    const maxNameLength = maxPerName - suffix.length;
    const truncatedClusterName = normalizedClusterName.substring(0, maxNameLength);
    return `${truncatedClusterName}${suffix}`;
  });
}
