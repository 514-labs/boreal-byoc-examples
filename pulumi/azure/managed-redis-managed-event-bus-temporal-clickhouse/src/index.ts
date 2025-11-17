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
      console.log("⚠️  Note: The 'all' stack is for visualization only.");
      console.log("To deploy all stacks, use: npm run deploy:all");
      return {
        message: "Use the deploy-all script to deploy all stacks in order",
        stacks: ["base", "byoc-services", "datadog", "mds"],
      };

    default:
      throw new Error(
        `Unknown stack: ${stack}. Valid stacks are: base, byoc-services, datadog, mds, all`
      );
  }
}

// Execute the main function and handle its outputs
const executeStack = async () => {
  const outputs = await main();

  if (stack === "base" && outputs && typeof outputs === "object" && "aksCluster" in outputs) {
    // Export base stack outputs
    return {
      resourceGroupName: (outputs as any).resourceGroupName,
      aksClusterName: (outputs as any).aksClusterName,
      kubeconfig: (outputs as any).kubeconfig,
      privateSubnetId: (outputs as any).privateSubnetId,
      publicSubnetId: (outputs as any).publicSubnetId,
      isolatedSubnetId: (outputs as any).isolatedSubnetId,
      nodeResourceGroup: (outputs as any).nodeResourceGroup,
    };
  } else if (stack === "byoc-services" && outputs) {
    return outputs;
  } else if (stack === "datadog" && outputs) {
    return outputs;
  } else if (stack === "mds" && outputs) {
    return outputs;
  } else {
    return outputs;
  }
};

// Export the promise that resolves to the outputs
export = executeStack();
