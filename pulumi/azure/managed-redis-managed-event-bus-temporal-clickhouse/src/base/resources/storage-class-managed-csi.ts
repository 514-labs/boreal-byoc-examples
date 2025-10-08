import * as k8s from "@pulumi/kubernetes";

export async function createManagedCsiStorageClass(k8sProvider: k8s.Provider, dependsOn: any[]) {
  const sc = new k8s.storage.v1.StorageClass(
    "managed-csi",
    {
      metadata: {
        name: "managed-csi",
        annotations: { "storageclass.kubernetes.io/is-default-class": "false" },
      },
      provisioner: "disk.csi.azure.com",
      volumeBindingMode: "WaitForFirstConsumer",
      allowVolumeExpansion: true,
      parameters: {
        skuname: "Premium_LRS",
        kind: "Managed",
        cachingmode: "ReadOnly",
        fstype: "ext4",
      },
    },
    { provider: k8sProvider, dependsOn }
  );
}
