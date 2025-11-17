import * as k8s from "@pulumi/kubernetes";
import { HelmClickhouseArgs, installClickhouseViaHelm } from "./helm";
import { createManagedNamespace, ManagedNamespaceArgs } from "./managed-namespaces";

interface DeployClickhouseArgs {
  helmArgs: HelmClickhouseArgs;
}

export async function deployClickhouse(args: DeployClickhouseArgs) {
  // Create the managed namespace first (with k8sProvider)
  // const managedNamespace = await createManagedNamespace({
  //   ...args.managedNamespaceArgs,
  //   k8sProvider: args.k8sProvider,
  // });

  // Install ClickHouse - use the namespace name directly from args since it's a plain string
  // Add explicit dependency on the managed namespace to ensure it's created first
  await installClickhouseViaHelm(args.helmArgs);
}
