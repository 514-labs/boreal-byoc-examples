import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Creates the MDS (Moose Data Stack) configuration secret for ClickHouse
 * 
 * @param password - ClickHouse admin password
 * @param namespace - Target namespace for the secret
 * @param releaseOpts - Pulumi resource options
 * @returns Kubernetes secret with ClickHouse configuration
 */
export function createMdsConfigSecret(
  password: pulumi.Output<string>,
  namespace: string,
  releaseOpts: pulumi.CustomResourceOptions
): k8s.core.v1.Secret {
  return new k8s.core.v1.Secret(
    "sn-mds-clickhouse-config",
    {
      metadata: {
        name: "sn-mds-clickhouse-config",
        namespace: namespace,
      },
      stringData: {
        "uses-cloud-service": "false",

        // Cloud Service Host Configuration (empty for self-hosted)
        "cloud-provider": "",
        "cloud-region": "",
        "org-id": "",
        "token-key": "",
        "token-secret": "",

        // Connection configuration
        "use-ssl": "false", // Set to "true" if TLS is enabled

        // Non-Cloud Service Host Configuration
        "host": "clickhouse.byoc-clickhouse.svc.cluster.local",
        "host-http-port": "8123", // HTTP interface
        "native-port": "9000", // Native TCP interface
        "admin-username": "default",
        "admin-password": password,
      },
    },
    releaseOpts
  );
}
