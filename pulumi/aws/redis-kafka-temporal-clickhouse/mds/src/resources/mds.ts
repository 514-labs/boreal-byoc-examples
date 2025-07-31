import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { secret } from "@pulumi/pulumi";

/**
 * Installs MDS
 *
 * @param releaseOpts - The release options
 * @returns MDS helm resource
 */
export async function installMds(releaseOpts: pulumi.CustomResourceOptions) {
  const config = new pulumi.Config();

  const borealWebhookSecret = config.require("borealWebhookSecret");
  
  const pulumiAccessToken = config.require("pulumiAccessToken");
  const pulumiPassphrase = config.require("pulumiPassphrase");
  
  const awsSecretAccessKey = config.require("awsMdsSecretAccessKey");
  const awsAccessKey = config.require("awsMdsAccessKey");
  const awsRegion = config.require("awsMdsRegion");
  const awsBorealConnectionHub = config.require("awsBorealConnectionHub");

  const redisProdDbUrl = config.require("redisProdDBURL");
  const redisProdMdsRequestChannel = config.require("redisProdMdsRequestChannel");
  const redisProdRegion = config.require("redisProdRegion");
  const redisProdDbName = config.require("redisProdDBName");
  const redisProdApiKey = config.require("redisProdApiKey");
  const redisProdSecretKey = config.require("redisProdSecretKey");
  const redisProdSubscriptionId = config.require("redisProdSubscriptionId");

  const mds = new k8s.helm.v3.Release(
    "mds",
    {
      repositoryOpts: {
        repo: "https://514-labs.github.io/helm-charts/",
      },
      chart: "mds",
      version: "0.2.0",
      namespace: "boreal-system",
      createNamespace: true,
      values: {
        deployment: {
          environment: "production",
          mdsEnvironment: "byoc-org_30RdcayVFU38hySbRb9zvyuLRG6",
          replicaCount: 1,
          image: {
            repository: "us-central1-docker.pkg.dev/moose-hosting-node/hosting-public/mds",
            tag: "f3604801ac",
            pullPolicy: "Always",
          },
        },
        mooseCache: {
          enabled: false,
        },
        secrets: {
          borealWebhook: {
            data: {
              secret: borealWebhookSecret,
            },
          },
          pulumi: {
            enabled: true,
            data: {
              organization: "514labs",
              passphrase: pulumiPassphrase,
              "access-token": pulumiAccessToken,
            },
          },
          aws: {
            enabled: true,
            data: {
              region: awsRegion,
              "access-key-id": awsAccessKey,
              "secret-access-key": awsSecretAccessKey,
              "boreal-connection-hub-vpc-endpoint-service-name": awsBorealConnectionHub,
            },
          },
          redis: {
            enabled: true,
            data: {
              /// org_30RdcayVFU38hySbRb9zvyuLRG6
              "connection-string": redisProdDbUrl,
              "mds-cluster-prefix": "mds::byoc::boreal::org_30RdcayVFU38hySbRb9zvyuLRG6::aws:us-east-2",
              "mds-request-channel": redisProdMdsRequestChannel,
              "region": redisProdRegion,
              "db-name": redisProdDbName,
              "api-key": redisProdApiKey,
              "secret-key": redisProdSecretKey,
              "subscription-id": redisProdSubscriptionId,
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
