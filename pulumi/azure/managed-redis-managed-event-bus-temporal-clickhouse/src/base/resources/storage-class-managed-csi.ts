import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Creates a Premium_ZRS storage class for AKS Automatic with customer-managed encryption
 *
 * Premium_ZRS (Zone-Redundant Storage) replicates data across 3 availability zones,
 * providing high availability and protection against zone failures.
 *
 * **VM Requirements:**
 * - ✅ Standard_D*s_v5 series and newer (SUPPORTS ZRS)
 * - ❌ Standard_D*_v4 series (does NOT support ZRS)
 *
 * **Benefits of ZRS:**
 * - Survives datacenter/zone failures
 * - 99.9999999999% (12 9's) durability
 * - Best for production workloads
 *
 * **Customer-Managed Key Encryption:**
 * - Full control over encryption keys
 * - Key rotation capability
 * - Compliance with regulatory requirements (HIPAA, PCI-DSS, etc.)
 * - Audit trail for key usage
 *
 * **Cost:**
 * - ~20-30% more than LRS for ZRS
 * - Additional cost for Key Vault operations and DiskEncryptionSet
 */
export async function createManagedCsiStorageClass(
  k8sProvider: k8s.Provider,
  diskEncryptionSetId: pulumi.Input<string>,
  dependsOn: any[]
) {
  const sc = new k8s.storage.v1.StorageClass(
    "boreal-managed-csi",
    {
      metadata: {
        name: "boreal-managed-csi",
        annotations: { "storageclass.kubernetes.io/is-default-class": "false" },
      },
      provisioner: "disk.csi.azure.com",
      volumeBindingMode: "WaitForFirstConsumer",
      allowVolumeExpansion: true,
      parameters: {
        skuname: "Premium_ZRS", // Zone-Redundant Storage (requires v5+ VMs)
        kind: "Managed",
        cachingmode: "ReadOnly",
        fstype: "ext4",
        diskEncryptionSetID: diskEncryptionSetId, // Customer-managed key encryption
      },
    },
    { provider: k8sProvider, dependsOn }
  );

  return sc;
}
