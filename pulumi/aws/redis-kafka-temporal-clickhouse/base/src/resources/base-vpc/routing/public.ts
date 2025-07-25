import * as aws from "@pulumi/aws";

export async function createPublicRouting(
  vpc: aws.ec2.Vpc,
  subnets: aws.ec2.Subnet[],
  commonTags: aws.Tags
) {
  /// Generate an internet gateway for the VPC
  const internetGateway = new aws.ec2.InternetGateway("boreal-igw", {
    vpcId: vpc.id,
    tags: {
      ...commonTags,
      Name: "boreal-igw",
    },
  });

  const natGateways: aws.ec2.NatGateway[] = [];
  const routingTables: aws.ec2.RouteTable[] = [];

  /// Use Promise.all to handle async operations
  await Promise.all(
    subnets.map(async (subnet, index) => {
      const routingTable = new aws.ec2.RouteTable(`boreal-public-rt-${index}`, {
        vpcId: vpc.id,
        tags: {
          Name: `boreal-public-rt-${index}`,
          ...commonTags,
        },
        routes: [
          {
            cidrBlock: vpc.cidrBlock,
            gatewayId: "local",
          },
          {
            cidrBlock: "0.0.0.0/0",
            gatewayId: internetGateway.id,
          },
        ],
      });

      /// Associate the routing table to the subnet
      new aws.ec2.RouteTableAssociation(`boreal-public-rt-association-${index}`, {
        subnetId: subnet.id,
        routeTableId: routingTable.id,
      });

      /// Generate an Elastic IP for the NAT Gateway
      const eip = new aws.ec2.Eip(`boreal-nat-eip-${index}`, {
        domain: "vpc",
        tags: {
          ...commonTags,
          Name: `boreal-nat-eip-${index}`,
        },
      });

      /// Generate a NAT Gateway for each subnet
      const natGateway = new aws.ec2.NatGateway(`boreal-nat-gateway-${index}`, {
        subnetId: subnet.id,
        allocationId: eip.id,
        connectivityType: "public",
        tags: {
          ...commonTags,
          Name: `boreal-nat-gateway-${index}`,
        },
      });

      natGateways.push(natGateway);
      routingTables.push(routingTable);
    })
  );

  return {
    routingTables,
    natGateways,
  };
}
