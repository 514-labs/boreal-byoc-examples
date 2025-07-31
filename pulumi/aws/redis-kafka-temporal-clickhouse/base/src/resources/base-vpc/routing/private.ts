import * as aws from "@pulumi/aws";

export async function createPrivateRouting(
  vpc: aws.ec2.Vpc,
  subnets: aws.ec2.Subnet[],
  natGateways: aws.ec2.NatGateway[],
  commonTags: aws.Tags
) {
  const routingTables = await Promise.all(
    subnets.map(async (subnet, index) => {
      /// Generate a routing table for each subnet
      const routingTable = new aws.ec2.RouteTable(`boreal-private-rt-${index}`, {
        vpcId: vpc.id,
        tags: {
          Name: `boreal-private-rt-${index}`,
          ...commonTags,
        },
        routes: [
          {
            cidrBlock: "0.0.0.0/0",
            natGatewayId: natGateways[index].id,
          },
          {
            cidrBlock: vpc.cidrBlock,
            gatewayId: "local",
          },
        ],
      });

      /// Associate the routing table to the subnet
      await new aws.ec2.RouteTableAssociation(`boreal-private-rt-association-${index}`, {
        subnetId: subnet.id,
        routeTableId: routingTable.id,
      });

      return routingTable;
    })
  );

  return routingTables;
}
