import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export const SubnetType = {
  public: "public",
  isolated: "isolated",
  private: "private",
} as const;
export type SubnetType = (typeof SubnetType)[keyof typeof SubnetType];

export interface SubnetArgs {
  vpcId: pulumi.Output<string>;
  cidrs: string[];
  mapPublicIpOnLaunch: boolean;
  numberOfAvailabilityZones: number;
  commonTags: aws.Tags;
}

export async function getAvailabilityZones() {
  return await aws.getAvailabilityZones({ state: "available" });
}

async function createSubnets(args: SubnetArgs, subnetType: SubnetType) {
  const availabilityZones = await getAvailabilityZones();
  const azNames = availabilityZones.names;

  const subnets: aws.ec2.Subnet[] = [];

  let additionalTags: aws.Tags = {};
  if (subnetType === SubnetType.private) {
    additionalTags["kubernetes.io/role/internal-elb"] = "1";
  }

  for (let i = 0; i < args.numberOfAvailabilityZones; i++) {
    const azName = azNames[i];
    const cidr = args.cidrs[i];
    const subnet = new aws.ec2.Subnet(`boreal-${subnetType}-${i + 1}`, {
      vpcId: args.vpcId,
      cidrBlock: cidr,
      mapPublicIpOnLaunch: args.mapPublicIpOnLaunch,
      availabilityZone: azName,
      tags: {
        Name: `boreal-${subnetType}-${i + 1}`,
        ...args.commonTags,
        ...additionalTags,
      },
    });
    subnets.push(subnet);
  }

  return {
    subnets,
    azNames,
  };
}

export async function createPublicSubnets(args: SubnetArgs) {
  return createSubnets(args, SubnetType.public);
}

export async function createIsolatedSubnets(args: SubnetArgs) {
  return createSubnets(args, SubnetType.isolated);
}

export async function createPrivateSubnets(args: SubnetArgs) {
  return createSubnets(args, SubnetType.private);
}
