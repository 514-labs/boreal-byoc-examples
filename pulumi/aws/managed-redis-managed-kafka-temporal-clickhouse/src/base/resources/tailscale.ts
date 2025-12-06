import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as command from "@pulumi/command";

/**
 * Installs the Tailscale Operator and optionally configures a subnet router
 *
 * @param releaseOpts - The release options
 * @returns The Tailscale Operator resource
 */
export async function installTailscaleOperator(
  tailscaleClientId: pulumi.Output<string>,
  tailscaleClientSecret: pulumi.Output<string>,
  k8sOperatorDefaultTags: string,
  k8sProxiesDefaultTags: string,
  operatorHostname: string,
  subnetRouterName: string,
  vpcCidr: string,
  createSubnetRouter: boolean,
  releaseOpts: pulumi.CustomResourceOptions
) {
  const tailscale = new k8s.helm.v3.Release(
    "tailscale",
    {
      repositoryOpts: {
        repo: "https://pkgs.tailscale.com/helmcharts",
      },
      chart: "tailscale-operator",
      version: "1.88.4",
      namespace: "tailscale",
      createNamespace: true,
      values: {
        oauth: {
          clientId: tailscaleClientId,
          clientSecret: tailscaleClientSecret,
        },
        // proxyConfig sets default tags for proxies created by the operator
        // (Services, Ingresses, etc.). Without this, proxies default to tag:k8s.
        proxyConfig: {
          defaultTags: k8sProxiesDefaultTags,
        },
        operatorConfig: {
          hostname: operatorHostname,
          defaultTags: k8sOperatorDefaultTags,
          acceptRoutes: true,
          // Ensure the operator pod runs on its own dedicated node
          nodeSelector: {
            "kubernetes.io/os": "linux",
          },
          // Prevent other pods from co-locating on the same node as the Tailscale operator
          affinity: {
            podAntiAffinity: {
              requiredDuringSchedulingIgnoredDuringExecution: [
                {
                  labelSelector: {
                    matchExpressions: [
                      {
                        key: "app.kubernetes.io/name",
                        operator: "NotIn",
                        values: ["tailscale-operator"],
                      },
                    ],
                  },
                  topologyKey: "kubernetes.io/hostname",
                },
              ],
            },
          },
          // Set resource requests and limits for the operator
          resources: {
            requests: {
              cpu: "100m",
              memory: "128Mi",
            },
            limits: {
              cpu: "500m",
              memory: "256Mi",
            },
          },
        },
        apiServerProxyConfig: {
          mode: "true",
        },
      },
      skipAwait: false,
    },
    releaseOpts
  );

  // Optionally create a Connector resource for subnet routing
  // This will advertise the VPC CIDR to the Tailscale network
  let subnetRouter;
  if (createSubnetRouter) {
    subnetRouter = new k8s.apiextensions.CustomResource(
      "tailscale-subnet-router",
      {
        apiVersion: "tailscale.com/v1alpha1",
        kind: "Connector",
        metadata: {
          name: subnetRouterName,
          namespace: "tailscale",
        },
        spec: {
          subnetRouter: {
            advertiseRoutes: [vpcCidr],
          },
          tags: k8sOperatorDefaultTags.split(",").map((tag) => tag.trim()),
        },
      },
      {
        ...releaseOpts,
        dependsOn: [tailscale],
      }
    );
  }

  return { tailscale, subnetRouter };
}
