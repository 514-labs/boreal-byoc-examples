import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Deploys the OpenTelemetry Collector Operator
 *
 * @param namespaceName - The namespace to deploy the operator into
 * @param releaseOpts - The release options including the k8s provider
 * @param certManager - Optional cert-manager release to depend on (required by otel-operator)
 * @returns The OpenTelemetry Operator release
 */
export async function deployOtelCollectorOperator(
  namespaceName: pulumi.Input<string>,
  releaseOpts: pulumi.CustomResourceOptions,
  certManager?: k8s.helm.v3.Release
) {
  const otelOperator = new k8s.helm.v3.Release(
    "otel-operator",
    {
      repositoryOpts: {
        repo: "https://open-telemetry.github.io/opentelemetry-helm-charts",
      },
      chart: "opentelemetry-operator",
      version: "0.75.1",
      namespace: namespaceName,
      values: {
        manager: {
          collectorImage: {
            repository: "otel/opentelemetry-collector-k8s",
          },
        },
      },
    },
    certManager ? { ...releaseOpts, dependsOn: [certManager] } : releaseOpts
  );

  return otelOperator;
}
