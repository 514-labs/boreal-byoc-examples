import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

// Azure built-in role definition IDs
// These are fixed GUIDs that are the same across all Azure subscriptions
// Reference: https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
const AZURE_ROLE_NETWORK_CONTRIBUTOR = "4d97b98b-1d4f-4787-a291-c67834d212e7";

interface AksIdentityArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  vnetId: pulumi.Input<string>;
  commonTags: { [k: string]: string };
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
export function createAksIdentityWithRole(args: AksIdentityArgs) {
  // Create a user-assigned managed identity for AKS
  // Required when using custom VNets
  const aksIdentity = new azure.managedidentity.UserAssignedIdentity("aks-identity", {
    resourceName: pulumi.interpolate`${args.resourceGroupName}-aks-identity`,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    tags: args.commonTags,
  });

  // Grant the AKS identity Network Contributor role on the VNet
  // This allows AKS to manage network resources within the VNet
  const networkContributorRole = new azure.authorization.RoleAssignment(
    "aks-vnet-network-contributor",
    {
      principalId: aksIdentity.principalId,
      principalType: "ServicePrincipal",
      roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${AZURE_ROLE_NETWORK_CONTRIBUTOR}`,
      scope: args.vnetId,
    }
  );

  return { aksIdentity, networkContributorRole };
}
