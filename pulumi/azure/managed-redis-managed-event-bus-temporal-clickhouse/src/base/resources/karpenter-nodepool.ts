import * as k8s from "@pulumi/kubernetes";

/**
 * Creates a Karpenter NodePool for AKS Automatic
 *
 * This constrains Karpenter to only provision D-series v5 VMs which support Premium_ZRS storage.
 *
 * Requirements for Premium_ZRS:
 * - Standard_D*s_v5 series (s = premium storage capable)
 * - Standard_D*d_v5 series (d = local disk)
 * - Standard_D*ds_v5 series (ds = both)
 */
export function createKarpenterNodePool(k8sProvider: k8s.Provider, dependsOn: any[]) {
  const nodePool = new k8s.apiextensions.CustomResource(
    "d-series-v5-nodepool",
    {
      apiVersion: "karpenter.sh/v1beta1",
      kind: "NodePool",
      metadata: {
        name: "d-series-v5",
      },
      spec: {
        template: {
          spec: {
            requirements: [
              {
                key: "karpenter.azure.com/sku-family",
                operator: "In",
                values: ["D"], // D-series VMs
              },
              {
                key: "karpenter.azure.com/sku-version",
                operator: "In",
                values: ["5"], // v5 generation only
              },
              //   {
              //     key: "karpenter.azure.com/sku-cpu",
              //     operator: "In",
              //     values: ["4", "8", "16", "32"], // CPU sizes we want
              //   },
              {
                key: "kubernetes.io/arch",
                operator: "In",
                values: ["amd64"],
              },
              {
                key: "karpenter.sh/capacity-type",
                operator: "In",
                values: ["on-demand"], // Use on-demand instances
              },
            ],
            nodeClassRef: {
              name: "default", // AKS Automatic creates a default NodeClass
            },
          },
        },
        // Disruption settings - when to replace nodes
        disruption: {
          consolidationPolicy: "WhenUnderutilized",
          expireAfter: "720h", // Replace nodes after 30 days
        },
        // Limits for this NodePool
        limits: {
          cpu: "1000",
          memory: "1000Gi",
        },
      },
    },
    {
      provider: k8sProvider,
      dependsOn: dependsOn,
    }
  );

  return nodePool;
}
