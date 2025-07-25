import { Buffer } from "buffer";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export async function createJumpBox(
  vpc: aws.ec2.Vpc,
  subnets: aws.ec2.Subnet[],
  commonTags: aws.Tags
) {
  const amiId = await aws.ssm.getParameter({
    name: "/aws/service/eks/optimized-ami/1.32/amazon-linux-2/recommended/image_id",
  });

  /// These auth keys are only good for 90 days.
  /// If there's an issue with getting the boxes to connect to tailscale, this could be the issue.
  const config = new pulumi.Config();
  const tailscaleAuthKey = config.require("tailscaleAuthKeyAws");

  const securityGroup = new aws.ec2.SecurityGroup("jump-box-security-group", {
    name: "boreal-jump-box",
    vpcId: vpc.id,
    tags: {
      Name: "boreal-jump-box",
      ...commonTags,
    },
    /// allow all traffic in from our network
    ingress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["10.0.0.0/8"],
      },
    ],
    /// allow all traffic out
    egress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
  });

  const launchTemplate = new aws.ec2.LaunchTemplate("jump-box-launch-template", {
    name: "boreal-jump-box",
    imageId: amiId.value,
    instanceType: "t3.micro",
    vpcSecurityGroupIds: [securityGroup.id],
    tags: {
      Name: "boreal-jump-box",
      ...commonTags,
    },
    userData: Buffer.from(
      `
            #!/bin/bash
            curl -fsSL https://tailscale.com/install.sh | sh
            tailscale up --auth-key ${tailscaleAuthKey}
            tailscale set --ssh
        `
    ).toString("base64"),
  });

  const asg = new aws.autoscaling.Group("jump-box-asg", {
    name: "boreal-jump-box",
    maxSize: 1,
    minSize: 1,
    desiredCapacity: 1,
    vpcZoneIdentifiers: subnets.map((subnet) => subnet.id),
    launchTemplate: {
      id: launchTemplate.id,
      version: "$Latest",
    },
    tags: [
      {
        key: "Name",
        value: "boreal-jump-box",
        propagateAtLaunch: true,
      },
      ...Object.entries(commonTags).map(([key, value]) => ({
        key,
        value,
        propagateAtLaunch: true,
      })),
    ],
  });
}
