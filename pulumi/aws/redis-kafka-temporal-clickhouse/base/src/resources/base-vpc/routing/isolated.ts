import * as aws from "@pulumi/aws";

export async function createIsolatedRouting(
  vpc: aws.ec2.Vpc,
  subnets: aws.ec2.Subnet[],
  commonTags: aws.Tags
) {
  const routingTables = await Promise.all(
    subnets.map(async (subnet, index) => {
      const routingTable = new aws.ec2.RouteTable(`boreal-isolated-rt-${index}`, {
        vpcId: vpc.id,
        tags: {
          Name: `boreal-isolated-rt-${index}`,
          ...commonTags,
        },
        routes: [
          {
            cidrBlock: vpc.cidrBlock,
            gatewayId: "local",
          },
        ],
      });

      /// Associate the routing table to the subnet
      const routeTableAssociation = new aws.ec2.RouteTableAssociation(
        `boreal-isolated-rt-association-${index}`,
        {
          subnetId: subnet.id,
          routeTableId: routingTable.id,
        }
      );

      return routingTable;
    })
  );

  return routingTables;
}
