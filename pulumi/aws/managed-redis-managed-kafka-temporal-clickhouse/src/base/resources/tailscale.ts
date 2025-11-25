import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as command from "@pulumi/command";

/**
 * Installs the Tailscale Operator
 *
 * @param releaseOpts - The release options
 * @returns The Tailscale Operator resource
 */
export async function installTailscaleOperator(
  tailscaleClientId: pulumi.Output<string>,
  tailscaleClientSecret: pulumi.Output<string>,
  k8sOperatorDefaultTags: string,
  operatorHostname: string,
  releaseOpts: pulumi.CustomResourceOptions
) {
  const tailscale = new k8s.helm.v3.Release(
    "tailscale",
    {
      repositoryOpts: {
        repo: "https://pkgs.tailscale.com/helmcharts",
      },
      chart: "tailscale-operator",
      version: "1.82.0",
      namespace: "tailscale",
      createNamespace: true,
      values: {
        oauth: {
          clientId: tailscaleClientId,
          clientSecret: tailscaleClientSecret,
        },
        operatorConfig: {
          hostname: operatorHostname,
          defaultTags: k8sOperatorDefaultTags,
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

  // // 2. Generate a temporary file path for the kubeconfig
  // const tempKubeconfigPath = `/tmp/tailscale-kubeconfig-${Date.now()}`;

  // // 3. Run the CLI to generate a kubeconfig and save it to the temp file using KUBECONFIG env var
  // const kubeconfigCmd = new command.local.Command("genKubeconfig", {
  //   create: pulumi.interpolate`KUBECONFIG=${tempKubeconfigPath} tailscale configure kubeconfig ${operatorHostName}`,
  // }, {
  //   dependsOn: [tailscale]
  // });

  // // 4. Read the kubeconfig from the temp file
  // const readKubeconfigCmd = new command.local.Command("readKubeconfig", {
  //   create: pulumi.interpolate`cat ${tempKubeconfigPath}`,
  //   delete: pulumi.interpolate`rm -f ${tempKubeconfigPath}`,
  // }, {
  //   dependsOn: [kubeconfigCmd]
  // });

  // const kubeconfig = readKubeconfigCmd.stdout;

  // return kubeconfig;
}
