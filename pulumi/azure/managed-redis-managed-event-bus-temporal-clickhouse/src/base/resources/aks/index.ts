import * as pulumi from "@pulumi/pulumi";
import { createAksCluster } from "./aks-install";
import { createAksIdentityWithRole } from "./aks-identity";
import { createAksClusterWithCli } from "./aks-cli-install";

export interface AksArgs {
  clusterName: string;
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  subnetId: pulumi.Input<string>;
  apiServerSubnetId: pulumi.Input<string>;
  vnetId: pulumi.Input<string>;
  serviceCidr: string;
  dnsServiceIP: string;
  adminGroupObjectIds: string[];
  commonTags: { [k: string]: string };
  // Optional: allow specifying a VM size to satisfy regional quota constraints for AKS Automatic
  nodeVmSize?: pulumi.Input<string>;
  // Optional: make the API server private (only accessible from VNet)
  enablePrivateCluster?: boolean;
}

export async function deployAksCluster(args: AksArgs) {
  // Create user-assigned identity for AKS with VNet permissions
  const { aksIdentity, networkContributorRole } = createAksIdentityWithRole({
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    vnetId: args.vnetId,
    commonTags: args.commonTags,
  });

  // Create cluster via CLI
  const { aksCluster, clusterId } = await createAksClusterWithCli(
    args,
    aksIdentity,
    networkContributorRole
  );
  return { aksCluster, clusterId };
}
