import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

/**
 * Creates Azure Key Vault with customer-managed key for disk encryption
 *
 * This sets up:
 * - Azure Key Vault with zone redundancy
 * - Encryption key for disk encryption
 * - DiskEncryptionSet that references the key
 * - Proper RBAC permissions for DiskEncryptionSet to access Key Vault
 *
 * Benefits:
 * - Customer control over encryption keys
 * - Ability to rotate keys
 * - Audit key usage
 * - Compliance with regulatory requirements (HIPAA, PCI-DSS, etc.)
 */
export async function createDiskEncryption(
  resourceGroupName: pulumi.Input<string>,
  location: string,
  name: string,
  commonTags: { [key: string]: string }
) {
  // Get current Azure client config for tenant ID
  const clientConfig = await azure.authorization.getClientConfig();

  // Create Key Vault with soft delete and purge protection enabled
  const keyVault = new azure.keyvault.Vault(`${name}-kv`, {
    vaultName: `${name}-kv`.substring(0, 24), // Key Vault names have 24 char limit
    resourceGroupName: resourceGroupName,
    location: location,
    properties: {
      sku: {
        family: "A",
        name: "premium", // Premium SKU required for HSM-backed keys
      },
      tenantId: clientConfig.tenantId,
      enableSoftDelete: true,
      softDeleteRetentionInDays: 7, // Minimum is 7 days
      enablePurgeProtection: true, // Prevents permanent deletion during retention period
      enabledForDiskEncryption: true, // Required for disk encryption
      enableRbacAuthorization: true, // Use RBAC instead of access policies
      networkAcls: {
        bypass: "AzureServices",
        defaultAction: "Allow", // Can be restricted to specific networks if needed
      },
    },
    tags: commonTags,
  });

  // Create encryption key in the vault
  const encryptionKey = new azure.keyvault.Key(
    `${name}-disk-key`,
    {
      keyName: "disk-encryption-key",
      resourceGroupName: resourceGroupName,
      vaultName: keyVault.name,
      properties: {
        kty: "RSA", // RSA key type
        keySize: 4096, // 4096-bit key for enhanced security
        keyOps: ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
        attributes: {
          enabled: true,
        },
      },
      tags: commonTags,
    },
    { dependsOn: [keyVault] }
  );

  // Create DiskEncryptionSet that will be used by storage class
  const diskEncryptionSet = new azure.compute.DiskEncryptionSet(
    `${name}-des`,
    {
      diskEncryptionSetName: `${name}-des`,
      resourceGroupName: resourceGroupName,
      location: location,
      identity: {
        type: "SystemAssigned", // Create a managed identity for the DiskEncryptionSet
      },
      encryptionType: "EncryptionAtRestWithCustomerKey",
      activeKey: {
        sourceVault: {
          id: keyVault.id,
        },
        keyUrl: pulumi
          .all([encryptionKey.keyUri, encryptionKey.keyUriWithVersion])
          .apply(([uri, uriWithVersion]) => uriWithVersion || uri),
      },
      tags: commonTags,
    },
    { dependsOn: [encryptionKey] }
  );

  // Grant the DiskEncryptionSet's managed identity access to the Key Vault key
  // This uses "Key Vault Crypto Service Encryption User" role (e147488a-f6f5-4113-8e2d-b22465e65bf6)
  const roleAssignment = new azure.authorization.RoleAssignment(
    `${name}-des-kv-access`,
    {
      principalId: diskEncryptionSet.identity.apply((i) => i!.principalId!),
      principalType: "ServicePrincipal",
      roleDefinitionId: pulumi.interpolate`/subscriptions/${clientConfig.subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/e147488a-f6f5-4113-8e2d-b22465e65bf6`,
      scope: keyVault.id,
    },
    { dependsOn: [diskEncryptionSet, keyVault] }
  );

  return {
    keyVault,
    encryptionKey,
    diskEncryptionSet,
    roleAssignment,
  };
}
