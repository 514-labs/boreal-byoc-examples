import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

interface NsgConfig {
  name: string;
  rules?: azure.types.input.network.SecurityRuleArgs[];
}

interface CreateNsgsArgs {
  namePrefix: string;
  resourceGroupName: pulumi.Input<string>;
  location: string;
  commonTags: { [k: string]: string };
  privateSubnet: NsgConfig;
  publicSubnet: NsgConfig;
  isolatedSubnet: NsgConfig;
  apiServerSubnet: NsgConfig;
}

export async function createNetworkSecurityGroups(args: CreateNsgsArgs) {
  const privateNsg = new azure.network.NetworkSecurityGroup("private-nsg", {
    networkSecurityGroupName: `${args.namePrefix}-private`,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    securityRules: args.privateSubnet.rules || [],
    tags: args.commonTags,
  });

  const publicNsg = new azure.network.NetworkSecurityGroup("public-nsg", {
    networkSecurityGroupName: `${args.namePrefix}-public`,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    securityRules: args.publicSubnet.rules || [],
    tags: args.commonTags,
  });

  const isolatedNsg = new azure.network.NetworkSecurityGroup("isolated-nsg", {
    networkSecurityGroupName: `${args.namePrefix}-isolated`,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    securityRules: args.isolatedSubnet.rules || [],
    tags: args.commonTags,
  });

  const apiServerNsg = new azure.network.NetworkSecurityGroup("api-server-nsg", {
    networkSecurityGroupName: `${args.namePrefix}-api-server`,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    securityRules: args.apiServerSubnet.rules || [],
    tags: args.commonTags,
  });

  return {
    privateNsg,
    publicNsg,
    isolatedNsg,
    apiServerNsg,
  };
}
