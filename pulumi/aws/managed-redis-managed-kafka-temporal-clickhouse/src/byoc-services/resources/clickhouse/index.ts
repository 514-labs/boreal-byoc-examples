import * as k8s from "@pulumi/kubernetes";
import { HelmClickhouseArgs, installClickhouseViaHelm } from "./helm-release";

interface DeployClickhouseArgs {
  helmArgs: HelmClickhouseArgs;
}

export async function deployClickhouse(args: DeployClickhouseArgs) {
  // Install ClickHouse
  await installClickhouseViaHelm(args.helmArgs);
}
