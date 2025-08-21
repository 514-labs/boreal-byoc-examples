import * as pulumi from "@pulumi/pulumi";

// Get the current stack name
const stack = pulumi.getStack();

// Execute different code based on the stack
async function main() {
  switch (stack) {
    case "base":
      console.log("Running base infrastructure stack...");
      const baseModule = await import("./base");
      return await baseModule.main();

    case "byoc-services":
      console.log("Running BYOC services stack...");
      const byocServicesModule = await import("./byoc-services");
      return await byocServicesModule.main();

    case "datadog":
      console.log("Running Datadog stack...");
      const datadogModule = await import("./datadog");
      return await datadogModule.main();

    case "mds":
      console.log("Running MDS stack...");
      const mdsModule = await import("./mds");
      return await mdsModule.main();

    case "all":
      // Special case: deploy all stacks in sequence
      console.log("⚠️  Note: The 'all' stack is for visualization only.");
      console.log("To deploy all stacks, use: npm run deploy:all");
      console.log("Or run: ts-node deploy-all.ts up");
      return {
        message: "Use the deploy-all script to deploy all stacks in order",
        stacks: ["base", "byoc-services", "datadog", "mds"],
      };

    default:
      throw new Error(
        `Unknown stack: ${stack}. Valid stacks are: base, secrets, byoc-services, datadog, mds, all`
      );
  }
}

// Execute the main function and handle its outputs
const executeStack = async () => {
  const outputs = await main();

  if (stack === "base" && outputs && typeof outputs === "object" && "vpc" in outputs) {
    // Export base stack outputs
    return {
      vpc: outputs.vpc,
      privateSubnets: outputs.privateSubnets,
      eksCluster: outputs.eksCluster,
      kubeconfig: outputs.eksCluster?.kubeconfig,
      eksSecurityGroupId: outputs.eksCluster?.core?.cluster?.vpcConfig?.clusterSecurityGroupId,
    };
  } else if (stack === "byoc-services" && outputs) {
    // Export byoc-services outputs if any
    return outputs;
  } else if (stack === "mds" && outputs) {
    // Export mds outputs if any
    return outputs;
  } else {
    return outputs;
  }
};

// Export the promise that resolves to the outputs
export = executeStack();
