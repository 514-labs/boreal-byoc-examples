import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";


export interface MdsConfig {
  dockerConfigJson: pulumi.Output<string>;
  mdsEnvironment: string;
  mdsImageTag: string;
  mdsImageRepository: string;
  mdsChartVersion: string;
  mdsClusterPrefix: string;
  borealWebhookUrl: string;
  borealWebhookSecret: pulumi.Output<string>;
  pulumiAccessToken: pulumi.Output<string>;
  pulumiPassphrase?: pulumi.Output<string>;
  awsMdsSecretAccessKey?: pulumi.Output<string>;
  awsMdsAccessKey?: pulumi.Output<string>;
  awsMdsRegion?: pulumi.Output<string>;
  awsBorealConnectionHub?: pulumi.Output<string>;
  redisProdDbUrl: string;
  redisProdMdsRequestChannel: string;
  redisProdRegion: string;
  redisProdDbName: string;
  redisProdApiKey: pulumi.Output<string>;
  redisProdSecretKey: pulumi.Output<string>;
  redisProdSubscriptionId: string;
}

/**
 * Installs MDS
 *
 * @param releaseOpts - The release options
 * @returns MDS helm resource
 */
export async function installMds(args: MdsConfig, releaseOpts: pulumi.CustomResourceOptions) {

  const mds = new k8s.helm.v3.Release(
    "mds",
    {
      repositoryOpts: {
        repo: "https://514-labs.github.io/helm-charts/",
      },
      chart: "mds",
      version: args.mdsChartVersion,
      namespace: "boreal-system",
      createNamespace: true,
      values: {
        environment: {
          boreal: {
            webHostingUrl: args.borealWebhookUrl,
            webhookSecret: args.borealWebhookSecret,
          }
        },
        deployment: {
          environment: "production",
          "mds-environment": args.mdsEnvironment,
          "cloud-provider": "aws",
          replicaCount: 1,
          image: {
            repository: args.mdsImageRepository,
            tag: args.mdsImageTag,
            pullPolicy: "Always",
          },
        },
        mooseCache: {
          enabled: false,
        },
        secrets: {
          imagePull: {
            enabled: true,
            data: {
              dockerConfigJson: args.dockerConfigJson,
            },
          },
          borealWebhook: {
            data: {
              secret: args.borealWebhookSecret,
            },
          },
          pulumi: {
            enabled: true,
            data: {
              organization: "514labs",
              passphrase: "n/a",
              "access-token": args.pulumiAccessToken,
            },
          },
          /// AWS Configuration - Required for ClickHouse ClickPipes.
          /// not available for BYOC MDS - we still want to create the sercret though so that orgs can easily move to Boreal MDS
          aws: {
            enabled: true,
            data: {
              region: args.awsMdsRegion || "n/a",
              "access-key-id": args.awsMdsAccessKey || "n/a",
              "secret-access-key": args.awsMdsSecretAccessKey || "n/a",
              "boreal-connection-hub-vpc-endpoint-service-name": args.awsBorealConnectionHub || "n/a",
            },
          },
          redis: {
            enabled: true,
            data: {
              "connection-string": args.redisProdDbUrl,
              "mds-cluster-prefix": args.mdsClusterPrefix,
              "mds-request-channel": args.redisProdMdsRequestChannel,
              "region": args.redisProdRegion,
              "db-name": args.redisProdDbName,
              "api-key": args.redisProdApiKey,
              "secret-key": args.redisProdSecretKey,
              "subscription-id": args.redisProdSubscriptionId,
            },
          },
          /// These secrets were created in the byoc-services stack
          clickhouse: {
            enabled: false,
          },
          redpanda: {
            enabled: false,
          },
          temporal: {
            enabled: false,
          },
        },
      },
    },
    {
      ...releaseOpts,
    }
  );
}
