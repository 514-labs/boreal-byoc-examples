import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { installMds } from "./resources/mds";
import { createPriorityClasses } from "./resources/priority-classes";

/**
 * This function is the main function that will be called when the program is run.
 * It will create the VPC, the subnets, and the routing tables.
 * It will also create the NAT Gateways and the Elastic IPs.
 * 3 subnets are created for each type: public, isolated, and private.
 * 3 availability zones are used.
 * The VPC and various resources will be tagged with the following tags:
 * - Cloud: aws
 * - Environment: prod
 * - Project: boreal
 */
async function main() {
  const stackName = pulumi.getStack();
  const projectName = pulumi.getProject();

  const config = new pulumi.Config();

  const dockerConfigJson = config.requireSecret("dockerConfigJson");
  const mdsEnvironment = config.require("mdsEnvironment");
  const mdsImageTag = config.require("mdsImageTag");
  const mdsImageRepository = config.require("mdsImageRepository");
  const mdsChartVersion = config.require("mdsChartVersion");
  const mdsClusterPrefix = config.require("mdsClusterPrefix");

  const borealWebhookUrl = config.require("borealWebhookUrl");
  const borealWebhookSecret = config.requireSecret("borealWebhookSecret");

  const pulumiAccessToken = config.requireSecret("pulumiAccessToken");
  const pulumiPassphrase = config.getSecret("pulumiPassphrase");

  /// AWS MDS Configuration - Required for ClickPipes
  const awsSecretAccessKey = config.getSecret("awsMdsSecretAccessKey");
  const awsAccessKey = config.getSecret("awsMdsAccessKey");
  const awsRegion = config.getSecret("awsMdsRegion");
  const awsBorealConnectionHub = config.getSecret("awsBorealConnectionHub");

  /// Redis Configuration - Required for Communication with Boreal Web Control Plane
  const redisProdDbUrl = config.require("redisProdDBURL");

  /// Moose Compute Class Resources Configuration - Optional per-project overrides
  const mooseComputeClassResources = config.getObject<Record<string, unknown>>(
    "mooseComputeClassResources"
  );

  // Get common tags from configuration and add the dynamic Project tag
  const commonTags = {
    Cloud: config.require("tagCloud"),
    Environment: config.require("tagEnvironment"),
    Project: projectName,
    Stack: stackName,
  };

  // Reference the base stack to get the EKS cluster
  const baseStack = new pulumi.StackReference("base", {
    name: `514labs/${projectName}/base`,
  });

  const kubeconfigOutput = baseStack.getOutput("kubeconfig") as pulumi.Output<string>;

  // Create a Kubernetes provider using the EKS cluster's kubeconfig
  const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: kubeconfigOutput,
  });

  const releaseOpts = {
    provider: k8sProvider,
  };

  await createPriorityClasses();

  await installMds(
    {
      dockerConfigJson,
      mdsEnvironment,
      mdsImageTag,
      mdsImageRepository,
      mdsChartVersion,
      mdsClusterPrefix,
      borealWebhookUrl,
      borealWebhookSecret,
      pulumiAccessToken,
      pulumiPassphrase,
      awsMdsSecretAccessKey: awsSecretAccessKey,
      awsMdsAccessKey: awsAccessKey,
      awsMdsRegion: awsRegion,
      awsBorealConnectionHub,
      redisProdDbUrl,
      mooseComputeClassResources,
    },
    releaseOpts
  );
}

// Export only the main function
export { main };
