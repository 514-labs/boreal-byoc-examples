import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as azure from "@pulumi/azure-native";

import { AksArgs } from "./index";

/**
 * Creates an AKS cluster in Automatic mode using Azure CLI
 *
 * AKS Automatic provides a managed experience similar to EKS Auto Mode and GKE Autopilot.
 * It automatically manages node provisioning, scaling, and cluster operations.
 *
 * **WHY AZURE CLI**: The Pulumi Azure Native SDK doesn't fully support API Server VNet Integration
 * with AKS Automatic yet. Using Azure CLI ensures we get the latest features and proper configuration.
 *
 * **IMPORTANT**: AKS Automatic mode requires availability zones.
 * You must deploy to a region that supports availability zones such as:
 * - eastus2, westus2, westus3, centralus, northeurope, westeurope, etc.
 *
 * Regions WITHOUT availability zone support (like eastus) will fail with:
 * "Managed cluster 'Automatic' SKU should enable 'AvailabilityZones' feature"
 *
 * **CUSTOM VNET INTEGRATION**: When using a custom VNet with userAssignedNATGateway:
 * - Requires user-assigned managed identity with Network Contributor role on VNet
 * - Private subnet must have a NAT Gateway associated with it
 * - NAT Gateway provides static public IP for egress (good for allowlisting)
 * - serviceCidr must not overlap with VNet CIDR or on-premises networks
 * - API Server VNet Integration places API server endpoint in a delegated subnet
 *
 * @param args - The arguments for the AKS cluster
 * @param args.clusterName - The name for the AKS cluster
 * @param args.resourceGroupName - The resource group to create the cluster in
 * @param args.location - The Azure region to deploy to (must support availability zones)
 * @param args.subnetId - The subnet ID for cluster nodes
 * @param args.apiServerSubnetId - The subnet ID for API server VNet integration
 * @param args.vnetId - The VNet ID for network access permissions
 * @param args.serviceCidr - CIDR for Kubernetes service IPs (internal to cluster)
 * @param args.dnsServiceIP - IP address for the Kubernetes DNS service (must be within serviceCidr)
 * @param args.adminGroupObjectIds - Azure AD group IDs for cluster admins
 * @param args.commonTags - Common tags to apply to resources
 * @param args.nodeVmSize - Optional VM size for nodes
 * @returns The AKS cluster command resource and cluster ID
 */
export async function createAksClusterWithCli(
  args: AksArgs,
  aksIdentity: azure.managedidentity.UserAssignedIdentity,
  networkContributorRole: azure.authorization.RoleAssignment
) {
  // IMPORTANT: Always create cluster as PUBLIC first
  // This allows Pulumi to connect and install Kubernetes resources (CRDs, Tailscale, etc.)
  // If enablePrivateCluster is true, we'll update it to private AFTER resources are installed

  // Create the AKS Automatic cluster using Azure CLI (always public initially)
  // This ensures we get the latest features including API Server VNet Integration
  const aksCluster = new command.local.Command(
    "aks-automatic",
    {
      create: pulumi.interpolate`az aks create \
  --resource-group ${args.resourceGroupName} \
  --name ${args.clusterName} \
  --location ${args.location} \
  --tier standard \
  --sku automatic \
  --network-plugin azure \
  --vnet-subnet-id ${args.subnetId} \
  --enable-apiserver-vnet-integration \
  --apiserver-subnet-id ${args.apiServerSubnetId} \
  --service-cidr ${args.serviceCidr} \
  --dns-service-ip ${args.dnsServiceIP} \
  --outbound-type userAssignedNATGateway \
  --assign-identity ${aksIdentity.id} \
  --enable-aad \
  --enable-azure-rbac \
  --aad-admin-group-object-ids "${args.adminGroupObjectIds[0]}" \
  --node-count 3 \
  --node-vm-size ${args.nodeVmSize || "Standard_D4s_v3"} \
  --auto-upgrade-channel stable \
  --output json`,

      // Delete command - clean up the cluster when destroyed
      delete: pulumi.interpolate`az aks delete \
  --resource-group ${args.resourceGroupName} \
  --name ${args.clusterName} \
  --yes`,
    },
    {
      dependsOn: [networkContributorRole],
    }
  );

  // Parse the cluster ID from the output
  const clusterId = aksCluster.stdout.apply((stdout: string) => {
    try {
      const cluster = JSON.parse(stdout);
      return cluster.id as string;
    } catch (e) {
      // If parsing fails, construct the cluster ID from known values
      const subscriptionId = azure.authorization.getClientConfigOutput().subscriptionId;
      return pulumi.interpolate`/subscriptions/${subscriptionId}/resourcegroups/${args.resourceGroupName}/providers/Microsoft.ContainerService/managedClusters/${args.clusterName}`;
    }
  });

  return { aksCluster, clusterId };
}

/**
 * Updates the AKS cluster to enable private cluster mode
 *
 * This should be called AFTER all Kubernetes resources are installed,
 * since a private cluster can only be accessed from within the VNet.
 *
 * @param args - The AKS cluster arguments
 * @param aksCluster - The cluster creation command (to ensure it exists first)
 * @param k8sResourcesDependency - A resource that represents all K8s resources being installed
 * @returns Command resource for the update operation
 */
export function makeClusterPrivate(
  args: AksArgs,
  aksCluster: command.local.Command,
  k8sResourcesDependency: pulumi.Resource
) {
  if (!args.enablePrivateCluster) {
    // If private cluster is not enabled, return undefined
    return undefined;
  }

  // Update the cluster to enable private cluster mode
  // This runs AFTER all Kubernetes resources are installed
  const makePrivate = new command.local.Command(
    "aks-make-private",
    {
      create: pulumi.interpolate`az aks update \
  --resource-group ${args.resourceGroupName} \
  --name ${args.clusterName} \
  --enable-private-cluster \
  --output json`,
    },
    {
      dependsOn: [aksCluster, k8sResourcesDependency],
    }
  );

  return makePrivate;
}
