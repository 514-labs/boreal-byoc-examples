import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Installs cert-manager for managing TLS certificates in the cluster
 *
 * @param releaseOpts - The release options including the k8s provider
 * @returns The cert-manager release
 */
export async function installCertManager(releaseOpts: pulumi.CustomResourceOptions) {
  const certManager = new k8s.helm.v3.Release(
    "cert-manager",
    {
      repositoryOpts: {
        repo: "https://charts.jetstack.io",
      },
      chart: "cert-manager",
      version: "v1.17.1",
      namespace: "cert-manager",
      createNamespace: true,
      values: {
        crds: {
          enabled: true,
        },
      },
    },
    releaseOpts
  );

  return certManager;
}
