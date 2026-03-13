import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export async function installTailscaleOperator(
  tailscaleClientId: pulumi.Input<string>,
  tailscaleClientSecret: pulumi.Input<string>,
  k8sOperatorDefaultTags: string,
  releaseOpts: pulumi.CustomResourceOptions,
  hostname: pulumi.Input<string>
) {
  console.log("Installing Tailscale Operator");
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
        operatorConfig: {
          hostname: hostname,
          defaultTags: k8sOperatorDefaultTags,
        },
        apiServerProxyConfig: {
          mode: "true",
        },
      },
      skipAwait: false,
    },
    releaseOpts
  );
}
