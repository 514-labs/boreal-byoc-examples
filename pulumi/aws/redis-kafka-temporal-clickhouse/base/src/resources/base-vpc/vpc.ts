import * as aws from "@pulumi/aws";
import { createIsolatedSubnets, createPublicSubnets } from "./subnets";
import { createIsolatedRouting } from "./routing/isolated";
import { createPrivateRouting } from "./routing/private";
import { createPublicRouting } from "./routing/public";
import { createPrivateSubnets } from "./subnets";

export interface VpcArgs {
  cidrBlock: string;
  commonTags: aws.Tags;
}

export async function createVpc(args: VpcArgs) {
  const numberOfAvailabilityZones = 3;

  const vpc = new aws.ec2.Vpc("main", {
    cidrBlock: args.cidrBlock,
    instanceTenancy: "default",
    enableDnsSupport: true,
    enableDnsHostnames: true,
    tags: {
      Name: "boreal",
      ...args.commonTags,
    },
  } as aws.ec2.VpcArgs);

  const { publicSubnetCidrs, isolatedSubnetCidrs, privateSubnetCidrs } =
    await defaultVPCSubnetCIDRSplit(args.cidrBlock);

  const { subnets: publicSubnets, azNames: azNames } = await createPublicSubnets({
    vpcId: vpc.id,
    cidrs: publicSubnetCidrs,
    mapPublicIpOnLaunch: true,
    numberOfAvailabilityZones: numberOfAvailabilityZones,
    commonTags: args.commonTags,
  });

  const { subnets: isolatedSubnets, azNames: isolatedAzNames } = await createIsolatedSubnets({
    vpcId: vpc.id,
    cidrs: isolatedSubnetCidrs,
    mapPublicIpOnLaunch: false,
    numberOfAvailabilityZones: numberOfAvailabilityZones,
    commonTags: args.commonTags,
  });

  const { subnets: privateSubnets, azNames: privateAzNames } = await createPrivateSubnets({
    vpcId: vpc.id,
    cidrs: privateSubnetCidrs,
    mapPublicIpOnLaunch: false,
    numberOfAvailabilityZones: numberOfAvailabilityZones,
    commonTags: args.commonTags,
  });

  const { natGateways: natGateways } = await createPublicRouting(
    vpc,
    publicSubnets,
    args.commonTags
  );
  const isolatedRouting = await createIsolatedRouting(vpc, isolatedSubnets, args.commonTags);
  const privateRouting = await createPrivateRouting(
    vpc,
    privateSubnets,
    natGateways,
    args.commonTags
  );

  return {
    vpc,
    azNames,
    publicSubnets,
    isolatedSubnets,
    privateSubnets,
  };
}

export async function defaultVPCSubnetCIDRSplit(vpcCidr: string) {
  const cidrBlockParts = vpcCidr.split("/");
  if (cidrBlockParts.pop() !== "16") {
    throw new Error("CIDR block must be a /16");
  }

  const octets = cidrBlockParts[0].split(".");
  if (octets[2] !== "0" || octets[3] !== "0") {
    throw new Error("Last two octets of CIDR block must be 0");
  }

  const secondOctet = parseInt(octets[1]);

  const publicSubnetCidrs = [
    `10.${secondOctet}.0.0/24`,
    `10.${secondOctet}.1.0/24`,
    `10.${secondOctet}.2.0/24`,
  ];
  const isolatedSubnetCidrs = [
    `10.${secondOctet}.3.0/24`,
    `10.${secondOctet}.4.0/24`,
    `10.${secondOctet}.5.0/24`,
  ];
  const privateSubnetCidrs = [
    `10.${secondOctet}.128.0/19`,
    `10.${secondOctet}.160.0/19`,
    `10.${secondOctet}.192.0/19`,
  ];

  return {
    publicSubnetCidrs,
    isolatedSubnetCidrs,
    privateSubnetCidrs,
  };
}
