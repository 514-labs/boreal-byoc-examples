import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Install Gateway API CRDs
 * This installs the Kubernetes Gateway API CRDs which are required for HTTPRoute resources
 * We use the experimental channel to get the full set of CRDs
 */
export async function installGatewayApiCrds(
  releaseOpts: pulumi.CustomResourceOptions
): Promise<k8s.yaml.v2.ConfigGroup> {
  // Using the experimental channel to get the complete set of CRDs
  // Fetch the YAML content from the URL
  const response = await fetch(
    "https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/experimental-install.yaml"
  );
  const yamlContent = await response.text();

  const gatewayCrds = new k8s.yaml.v2.ConfigGroup(
    "gateway-api-crds",
    {
      yaml: yamlContent,
    },
    {
      ...releaseOpts,
    }
  );

  return gatewayCrds;
}
