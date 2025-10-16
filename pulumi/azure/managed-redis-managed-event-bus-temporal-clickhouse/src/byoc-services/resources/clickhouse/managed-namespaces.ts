import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as azure from "@pulumi/azure-native";

export interface ManagedNamespaceArgs {
  clusterName: pulumi.Input<string>;
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  namespaceName: string;
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  commonTags: { [k: string]: string };
  k8sProvider: k8s.Provider;
}

/**
 * Creates a managed namespace for AKS Automatic with custom resource quotas
 *
 * This creates a namespace directly in Kubernetes with the special label
 * that tells AKS Automatic to manage it. AKS will automatically:
 * 1. Detect the label "kubernetes.azure.com/managedByArm: true"
 * 2. Create the corresponding ARM resource
 * 3. Apply default resource quotas based on cluster configuration
 *
 * NOTE: The resource quotas are configured via Azure Portal or ARM API separately.
 * Creating just the K8s namespace with the label is the fastest approach (< 1 min).
 *
 * Managed namespaces allow you to set namespace-specific resource limits,
 * bypassing the cluster-wide Gatekeeper/Azure Policy restrictions.
 *
 * This is particularly useful for workloads like ClickHouse that need
 * more resources than the default 1Gi memory limit in AKS Automatic.
 *
 * @see https://learn.microsoft.com/en-us/azure/aks/managed-namespaces
 *
 * @param args - Configuration for the managed namespace
 * @returns The managed namespace resource
 */
export async function createManagedNamespace(args: ManagedNamespaceArgs) {
  // Filter commonTags to only include tags with values <= 63 chars (K8s label limit)
  const k8sLabels: { [k: string]: string } = {};
  for (const [key, value] of Object.entries(args.commonTags)) {
    if (key.length <= 63 && value.length <= 63) {
      k8sLabels[key] = value;
    }
  }

  // IMPORTANT: Create namespace via ARM only (not K8s directly)
  // This avoids race conditions and stuck operations
  const managedNamespace = new azure.containerservice.ManagedNamespace(
    `managed-ns-${args.namespaceName}`,
    {
      resourceGroupName: args.resourceGroupName,
      resourceName: args.clusterName,
      managedNamespaceName: `${args.namespaceName}`,
      location: args.location,
      properties: {
        // Resource quotas for this namespace
        defaultResourceQuota: {
          cpuRequest: args.cpuRequest,
          cpuLimit: args.cpuLimit,
          memoryRequest: args.memoryRequest,
          memoryLimit: args.memoryLimit,
        },
        // Network policies - allow all for now (can be restricted later)
        defaultNetworkPolicy: {
          ingress: "AllowAll",
          egress: "AllowAll",
        },
        // "Never" - fail if namespace already exists (cleaner than adoption)
        adoptionPolicy: "Never",
        // "Delete" - delete the namespace and all resources in it
        deletePolicy: "Delete",
        labels: {
          ...k8sLabels,
        },
      },
    },
    {
      deleteBeforeReplace: true,
      protect: false,
      replaceOnChanges: ["properties.defaultResourceQuota"],
    }
  );

  // Return the managed namespace
  return managedNamespace;
}
