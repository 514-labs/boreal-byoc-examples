import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as eks from "@pulumi/eks";

/**
 * Creates the gp3 storage class using the EKS-managed EBS CSI driver
 * 
 * @param eksCluster - The EKS cluster
 * @param k8sProvider - The Kubernetes provider
 * @returns The storage class resource
 */
export async function createGp3StorageClass(
  eksCluster: eks.Cluster,
  k8sProvider: k8s.Provider
): Promise<k8s.storage.v1.StorageClass> {
  // EKS manages its own EBS CSI driver under ebs.csi.eks.amazonaws.com
  // We don't need to install it separately
  
  // Create the gp3 storage class using the EKS-managed CSI driver
  const gp3StorageClass = new k8s.storage.v1.StorageClass(
    "gp3",
    {
      metadata: {
        name: "gp3",
        annotations: {
          "storageclass.kubernetes.io/is-default-class": "false",
        },
      },
      provisioner: "ebs.csi.eks.amazonaws.com", // Use the EKS-managed CSI driver
      volumeBindingMode: "WaitForFirstConsumer",
      allowVolumeExpansion: true,
      parameters: {
        type: "gp3",
        // GP3 specific parameters for better performance
        iops: "3000", // Baseline IOPS for gp3
        throughput: "125", // Baseline throughput in MiB/s
        encrypted: "true",
        fsType: "ext4",
      },
      // No topology constraints - let EKS handle it
    },
    {
      provider: k8sProvider,
      dependsOn: [eksCluster], // Depend on the cluster, not a separate addon
    }
  );

  return gp3StorageClass;
}
