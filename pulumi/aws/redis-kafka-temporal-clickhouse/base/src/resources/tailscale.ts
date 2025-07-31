import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Installs the Tailscale Operator
 *
 * @param releaseOpts - The release options
 * @returns The Tailscale Operator resource
 */
export async function installTailscaleOperator(releaseOpts: pulumi.CustomResourceOptions) {
  const config = new pulumi.Config();
  const tailscaleClientId = config.require("tailscaleClientId");
  const tailscaleClientSecret = config.require("tailscaleClientSecret");

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
          hostname: "aws-sandbox-tailscale-operator-us-east-2",
        },
        apiServerProxyConfig: {
          mode: "noauth",
        },
      },
    },
    releaseOpts
  );
}
