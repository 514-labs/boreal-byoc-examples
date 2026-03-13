import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

import { createNatGateway } from "./nat";
import { createNetworkSecurityGroups } from "./nsg";

interface SubnetConfig {
  cidr: string;
  nsgRules?: azure.types.input.network.SecurityRuleArgs[];
}

interface NetworkArgs {
  resourceGroupName: pulumi.Input<string>;
  vnetName: string;
  location: string;
  commonTags: { [k: string]: string };
  vnetCidr: string;
  privateSubnet: SubnetConfig;
  publicSubnet: SubnetConfig;
  isolatedSubnet: SubnetConfig;
  apiServerSubnet: SubnetConfig;
}

export async function createNetwork(args: NetworkArgs) {
  // Create NAT Gateway for outbound egress
  const { natGateway } = await createNatGateway({
    name: args.vnetName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    commonTags: args.commonTags,
  });

  // Create NSGs with consistent naming
  const { privateNsg, publicNsg, isolatedNsg, apiServerNsg } = await createNetworkSecurityGroups({
    namePrefix: args.vnetName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    commonTags: args.commonTags,
    privateSubnet: {
      name: `${args.vnetName}-private`,
      rules: args.privateSubnet.nsgRules,
    },
    publicSubnet: {
      name: `${args.vnetName}-public`,
      rules: args.publicSubnet.nsgRules,
    },
    isolatedSubnet: {
      name: `${args.vnetName}-isolated`,
      rules: args.isolatedSubnet.nsgRules,
    },
    apiServerSubnet: {
      name: `${args.vnetName}-api-server`,
      rules: args.apiServerSubnet.nsgRules,
    },
  });

  // Create VNet with consistent naming
  const vnet = new azure.network.VirtualNetwork("vnet", {
    virtualNetworkName: args.vnetName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    addressSpace: { addressPrefixes: [args.vnetCidr] },
    tags: args.commonTags,
  });

  // Create subnets with NSG associations and NAT Gateway
  const privateSubnet = new azure.network.Subnet("private-subnet", {
    subnetName: `${args.vnetName}-private`,
    resourceGroupName: args.resourceGroupName,
    virtualNetworkName: vnet.name,
    addressPrefix: args.privateSubnet.cidr,
    networkSecurityGroup: { id: privateNsg.id },
    natGateway: { id: natGateway.id },
  });

  const publicSubnet = new azure.network.Subnet("public-subnet", {
    subnetName: `${args.vnetName}-public`,
    resourceGroupName: args.resourceGroupName,
    virtualNetworkName: vnet.name,
    addressPrefix: args.publicSubnet.cidr,
    networkSecurityGroup: { id: publicNsg.id },
    natGateway: { id: natGateway.id },
  });

  const isolatedSubnet = new azure.network.Subnet("isolated-subnet", {
    subnetName: `${args.vnetName}-isolated`,
    resourceGroupName: args.resourceGroupName,
    virtualNetworkName: vnet.name,
    addressPrefix: args.isolatedSubnet.cidr,
    networkSecurityGroup: { id: isolatedNsg.id },
    // Isolated subnet typically doesn't need NAT Gateway
  });

  // Create dedicated subnet for AKS API server VNet integration
  // This subnet must be separate from the node subnet
  // Delegation is required for API Server VNet Integration
  const apiServerSubnet = new azure.network.Subnet("api-server-subnet", {
    subnetName: `${args.vnetName}-api-server`,
    resourceGroupName: args.resourceGroupName,
    virtualNetworkName: vnet.name,
    addressPrefix: args.apiServerSubnet.cidr,
    networkSecurityGroup: { id: apiServerNsg.id },
    // Delegate subnet to AKS for API Server VNet Integration
    delegations: [
      {
        name: "aks-delegation",
        serviceName: "Microsoft.ContainerService/managedClusters",
      },
    ],
  });

  return {
    vnet,
    privateSubnet,
    publicSubnet,
    isolatedSubnet,
    apiServerSubnet,
  };
}
