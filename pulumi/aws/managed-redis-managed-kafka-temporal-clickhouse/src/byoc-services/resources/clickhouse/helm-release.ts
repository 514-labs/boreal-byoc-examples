import * as path from "path";
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

export interface HelmClickhouseArgs {
  namespace: string;
  clickhouseShards: number;
  clickhouseReplicas: number;
  clickhouseStorageSize: string;
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  releaseOpts: pulumi.CustomResourceOptions;
}

export async function installClickhouseViaHelm(args: HelmClickhouseArgs) {
  const password = new random.RandomPassword("clickhouse-password", {
    length: 16,
    special: false,
  });

  // Path to the local helm chart (8 levels up from this file to repo root)
  const chartPath = path.join(__dirname, "../../../../../../../external/helm/clickhouse");

  const helmRelease = new k8s.helm.v3.Release(
    "clickhouse",
    {
      chart: chartPath,
      namespace: args.namespace,
      createNamespace: true,
      values: {
        fullnameOverride: "clickhouse",
        clickhouse: {
          shards: args.clickhouseShards,
          replicasPerShard: args.clickhouseReplicas,
          clusterName: "default",
          auth: {
            enabled: true,
            createSecret: true,
            username: "default",
            password: password.result,
          },
          persistentVolume: {
            enabled: true,
            size: args.clickhouseStorageSize,
            storageClass: "gp3", // AWS EBS gp3 storage class
          },
          resources: {
            requests: { memory: args.memoryRequest, cpu: args.cpuRequest },
            limits: { memory: args.memoryLimit, cpu: args.cpuLimit },
          },
          logLevel: "information",
          metrics: {
            enabled: true,
          },
        },
        keeper: {
          enabled: true,
          replicas: 3,
          persistentVolume: {
            enabled: true,
            size: "10Gi",
            storageClass: "gp3", // AWS EBS gp3 storage class
          },
          resources: {
            requests: { memory: "512Mi", cpu: "250m" },
            limits: { memory: "1Gi", cpu: "500m" },
          },
          logLevel: "information",
          metrics: {
            enabled: true,
          },
        },
        ports: {
          clickhouse: {
            http: 8123,
            tcp: 9000,
            mysql: 9004,
            interserver: 9009,
            metrics: 9363,
          },
          keeper: {
            client: 9181,
            raft: 9234,
            httpControl: 9182,
            metrics: 9363,
          },
        },
      },
    },
    { ...args.releaseOpts }
  );

  const mdsConfigSecret = new k8s.core.v1.Secret(
    "sn-mds-clickhouse-config",
    {
      metadata: { name: "sn-mds-clickhouse-config", namespace: "boreal-system" },
      stringData: {
        username: "default",
        password: password.result,
        database: "default",
        host: "clickhouse.byoc-clickhouse.svc.cluster.local",
        port: "9000",
      },
    },
    { ...args.releaseOpts }
  );

  return { helmRelease, password: password.result, mdsConfigSecret };
}
