import { Buffer } from "buffer";
import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

interface JumpBoxArgs {
  resourceGroupName: pulumi.Input<string>;
  subnetId: pulumi.Input<string>;
  location: pulumi.Input<string>;
  commonTags: { [k: string]: string };
  vmName: string;
  vmSize: string;
  adminUsername: string;
  sshPublicKey: pulumi.Input<string>;
  tailscaleAuthKey: pulumi.Input<string>;
}

export async function createJumpBox(args: JumpBoxArgs) {
  const nic = new azure.network.NetworkInterface("jumpbox-nic", {
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    ipConfigurations: [
      {
        name: "ipcfg",
        subnet: { id: args.subnetId },
        privateIPAllocationMethod: "Dynamic",
      },
    ],
    tags: args.commonTags,
  });

  const vm = new azure.compute.VirtualMachine("jumpbox", {
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    hardwareProfile: { vmSize: args.vmSize },
    osProfile: {
      computerName: args.vmName,
      adminUsername: args.adminUsername,
      linuxConfiguration: {
        disablePasswordAuthentication: true,
        ssh: {
          publicKeys: [
            {
              path: pulumi.interpolate`/home/${args.adminUsername}/.ssh/authorized_keys`,
              keyData: args.sshPublicKey,
            },
          ],
        },
      },
      customData: pulumi.all([args.tailscaleAuthKey]).apply(([key]) =>
        Buffer.from(
          `#cloud-config
runcmd:
  - curl -fsSL https://tailscale.com/install.sh | sh
  - tailscale up --auth-key ${key}
  - tailscale set --ssh
`
        ).toString("base64")
      ),
    },
    storageProfile: {
      osDisk: {
        name: pulumi.interpolate`${args.vmName}-osdisk`,
        createOption: "FromImage",
        managedDisk: { storageAccountType: "Premium_LRS" },
      },
      imageReference: {
        publisher: "Canonical",
        offer: "0001-com-ubuntu-server-jammy",
        sku: "22_04-lts",
        version: "latest",
      },
    },
    networkProfile: { networkInterfaces: [{ id: nic.id }] },
    tags: args.commonTags,
  });
}
