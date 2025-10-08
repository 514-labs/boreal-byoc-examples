import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

interface NatArgs {
  name: string;
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  commonTags: { [k: string]: string };
}

export async function createNatGateway(args: NatArgs) {
  const publicIp = new azure.network.PublicIPAddress("nat-public-ip", {
    publicIpAddressName: args.name,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    sku: { name: "Standard" },
    publicIPAllocationMethod: "Static",
    tags: args.commonTags,
  });

  const natGateway = new azure.network.NatGateway("nat-gateway", {
    natGatewayName: args.name,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    sku: { name: "Standard" },
    publicIpAddresses: [{ id: publicIp.id }],
    tags: args.commonTags,
  });

  return { natGateway };
}
