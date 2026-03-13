import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { installMds } from "./resources/mds";
import { createPriorityClasses } from "./resources/priority-classes";

/**
 * This function is the main function that will be called when the program is run.
 * It will install MDS (Moose Deployment Service) in the Azure AKS cluster.
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

  /// AWS MDS Configuration - Required for ClickPipes and resource management
  const awsRegion = config.getSecret("awsMdsRegion");
  const awsAccessKey = config.getSecret("awsMdsAccessKey");
  const awsSecretAccessKey = config.getSecret("awsMdsSecretAccessKey");
  const awsBorealConnectionHub = config.getSecret("awsBorealConnectionHub");

  /// Redis Configuration - Required for Communication with Boreal Web Control Plane
  const redisProdDbUrl = config.require("redisProdDBURL");

  // Get common tags from configuration and add the dynamic Project tag
  const commonTags = {
    Cloud: config.require("tagCloud"),
    Environment: config.require("tagEnvironment"),
    Project: projectName,
    Stack: stackName,
  };

  // Reference the base stack to get the AKS cluster
  const baseStack = new pulumi.StackReference("base", {
    name: `514labs/${projectName}/base`,
  });

  const kubeconfigOutput = baseStack.getOutput("kubeconfig") as pulumi.Output<string>;

  // Create a Kubernetes provider using the AKS cluster's kubeconfig
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
      awsMdsRegion: awsRegion,
      awsMdsAccessKey: awsAccessKey,
      awsMdsSecretAccessKey: awsSecretAccessKey,
      awsBorealConnectionHub,
      redisProdDbUrl,
    },
    releaseOpts
  );
}

// Export only the main function
export { main };
