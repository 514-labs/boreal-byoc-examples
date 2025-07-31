import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Installs Redis
 *
 * @param releaseOpts - The release options
 * @returns The Redis resource
 */
export async function installRedis(releaseOpts: pulumi.CustomResourceOptions) {
  const redis = new k8s.helm.v3.Release(
    "redis",
    {
      repositoryOpts: {
        repo: "https://charts.bitnami.com/bitnami",
      },
      chart: "redis",
      version: "21.2.13",
      namespace: "byoc-redis-moose-cache",
      createNamespace: true,
      values: {
        auth: {
            enabled: true,
            username: "default",
            password: "redis-password-123",
        },
        architecture: "standalone", // or "replication" for master-slave
        master: {
          service: {
            type: "ClusterIP",
            port: 6379,
          },
          persistence: {
            enabled: false
          },
        },
        replica: {
          persistence: {
            enabled: false
          },
        },
      },
    },
    {
        ...releaseOpts,
    }
  );
}
