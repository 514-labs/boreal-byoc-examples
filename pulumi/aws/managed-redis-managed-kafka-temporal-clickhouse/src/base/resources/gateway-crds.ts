import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Install Gateway API CRDs
 * This installs the Kubernetes Gateway API CRDs which are required for HTTPRoute resources
 * We use the experimental channel to get the full set of CRDs
 */
export function installGatewayApiCrds(k8sProvider: k8s.Provider): k8s.yaml.v2.ConfigGroup {
  // Using the experimental channel to get the complete set of CRDs
  const gatewayCrds = new k8s.yaml.v2.ConfigGroup("gateway-api-crds", {
    yaml: "https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/experimental-install.yaml",
  }, {
    provider: k8sProvider,
  });

  return gatewayCrds;
}
