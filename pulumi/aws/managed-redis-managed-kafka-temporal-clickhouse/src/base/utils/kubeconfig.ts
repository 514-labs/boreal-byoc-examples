import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";

/**
 * Returns a kubeconfig with the AWS profile set to the value of the awsProfile config variable.
 * this allows us to login with aws sso as the boreal-admin user and use those credentials to access the EKS cluster.
 * @param eksCluster The EKS cluster to get the kubeconfig for.
 * @returns The kubeconfig with the AWS profile set.
 */
export async function getKubeconfig(eksCluster: eks.Cluster, awsProfile: string) {
  const modifiedKubeconfig = eksCluster.kubeconfig.apply((kcObject) => {
    const kubeconfigToModify = kcObject;

    // Ensure the structure is as expected before modifying
    if (kubeconfigToModify?.users?.[0]?.user?.exec) {
      // Add or overwrite the env array for the AWS CLI exec
      kubeconfigToModify.users[0].user.exec.env = [{ name: "AWS_PROFILE", value: awsProfile }];
    } else {
      // Log a warning if the structure isn't what we expect
      pulumi.log.warn(
        "Could not find users[0].user.exec in kubeconfig from EKS cluster object to inject AWS_PROFILE."
      );
    }
    // Return the modified kubeconfig as a JSON string
    return JSON.stringify(kubeconfigToModify);
  });

  return modifiedKubeconfig;
}
