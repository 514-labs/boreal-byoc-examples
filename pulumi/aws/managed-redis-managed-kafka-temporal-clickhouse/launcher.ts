import { LocalWorkspace, fullyQualifiedStackName } from "@pulumi/pulumi/automation";
import * as path from "path";

async function deployAllStacks() {
  console.log("🚀 Starting deployment of all stacks...\n");
  const overallStartTime = Date.now();

  const projectName = "BYOC-Example_AWS-Managed-Redis-Kafka-Self-Hosted-Temporal-Clickhouse";
  const org = "514labs"; // Update this to your org name if different

  // Define stacks in deployment order
  const stacks = [
    { name: "base", description: "VPC, EKS, and networking infrastructure" },
    { name: "byoc-services", description: "Redis, Kafka, Temporal, and ClickHouse services" },
    { name: "datadog", description: "Datadog" },
    { name: "mds", description: "MDS - Moose Deployment Service" },
  ];

  const stackTimings: { [key: string]: number } = {};

  try {
    for (const stackInfo of stacks) {
      console.log(`\n📦 Deploying stack: ${stackInfo.name}`);
      console.log(`   ${stackInfo.description}`);
      console.log("   " + "=".repeat(50));

      const stackStartTime = Date.now();

      // Use the root directory for all stacks
      const stackWorkDir = path.resolve();

      // Create or select the stack
      const stack = await LocalWorkspace.createOrSelectStack({
        stackName: stackInfo.name,
        workDir: stackWorkDir,
      });

      console.log(`   ✓ Stack ${stackInfo.name} selected`);

      // Get the stack info to check if it needs to be created
      const info = await stack.info();
      if (!info) {
        console.log(`   ℹ️  Stack ${stackInfo.name} doesn't exist, creating...`);
      }

      // Set up event handlers for progress
      console.log(`   🔄 Running 'pulumi up' for ${stackInfo.name}...`);

      const upResult = await stack.up({
        onOutput: (out) => process.stdout.write(out),
        onEvent: (event) => {
          if (event.diagnosticEvent && event.diagnosticEvent.severity === "error") {
            console.error(`   ❌ Error: ${event.diagnosticEvent.message}`);
          }
        },
      });

      if (upResult.summary.result === "succeeded") {
        const stackEndTime = Date.now();
        const stackDuration = (stackEndTime - stackStartTime) / 1000; // Convert to seconds
        stackTimings[stackInfo.name] = stackDuration;

        console.log(`\n   ✅ Stack ${stackInfo.name} deployed successfully!`);
        console.log(`   📊 Summary: ${upResult.summary.resourceChanges} resource changes`);
        console.log(`   ⏱️  Time: ${formatDuration(stackDuration)}`);
      } else {
        throw new Error(`Deployment of ${stackInfo.name} failed: ${upResult.summary.result}`);
      }

      // Show outputs
      const outputs = await stack.outputs();
      if (Object.keys(outputs).length > 0) {
        console.log(`   📤 Outputs:`);
        for (const [key, value] of Object.entries(outputs)) {
          console.log(`      - ${key}: ${JSON.stringify(value.value).substring(0, 100)}...`);
        }
      }
    }

    const overallEndTime = Date.now();
    const overallDuration = (overallEndTime - overallStartTime) / 1000;

    console.log("\n\n🎉 All stacks deployed successfully!");
    console.log("\n📋 Stack deployment summary:");
    for (const stackInfo of stacks) {
      const duration = stackTimings[stackInfo.name];
      console.log(`   ✓ ${stackInfo.name}: Deployed in ${formatDuration(duration)}`);
    }
    console.log(`\n⏱️  Total deployment time: ${formatDuration(overallDuration)}`);

    await new Promise((resolve) => setTimeout(resolve, 10000));
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Add destroy all function as well
async function destroyAllStacks() {
  console.log("🗑️  Starting destruction of all stacks...\n");
  console.log("⚠️  WARNING: This will destroy all resources in reverse order!\n");
  const overallStartTime = Date.now();

  const projectName = "BYOC-Example_AWS-Managed-Redis-Kafka-Self-Hosted-Temporal-Clickhouse";

  // Define stacks in REVERSE deployment order for destruction
  const stacks = [
    { name: "mds", description: "MDS - Moose Deployment Service" },
    { name: "byoc-services", description: "Redis, Kafka, Temporal, and ClickHouse services" },
    { name: "base", description: "VPC, EKS, and networking infrastructure" },
  ];

  const stackTimings: { [key: string]: number } = {};

  try {
    for (const stackInfo of stacks) {
      console.log(`\n🗑️  Destroying stack: ${stackInfo.name}`);
      console.log(`   ${stackInfo.description}`);
      console.log("   " + "=".repeat(50));

      const stackStartTime = Date.now();

      // Use the root directory for all stacks
      const stackWorkDir = path.resolve();

      const stack = await LocalWorkspace.selectStack({
        stackName: stackInfo.name,
        workDir: stackWorkDir,
      });

      console.log(`   🔄 Running 'pulumi destroy' for ${stackInfo.name}...`);

      const destroyResult = await stack.destroy({
        onOutput: (out) => process.stdout.write(out),
      });

      if (destroyResult.summary.result === "succeeded") {
        const stackEndTime = Date.now();
        const stackDuration = (stackEndTime - stackStartTime) / 1000;
        stackTimings[stackInfo.name] = stackDuration;

        console.log(`\n   ✅ Stack ${stackInfo.name} destroyed successfully!`);
        console.log(`   ⏱️  Time: ${formatDuration(stackDuration)}`);
      } else {
        throw new Error(`Destruction of ${stackInfo.name} failed: ${destroyResult.summary.result}`);
      }
    }

    const overallEndTime = Date.now();
    const overallDuration = (overallEndTime - overallStartTime) / 1000;

    console.log("\n\n✅ All stacks destroyed successfully!");
    console.log("\n📋 Stack destruction summary:");
    for (const stackInfo of stacks) {
      const duration = stackTimings[stackInfo.name];
      console.log(`   ✓ ${stackInfo.name}: Destroyed in ${formatDuration(duration)}`);
    }
    console.log(`\n⏱️  Total destruction time: ${formatDuration(overallDuration)}`);
  } catch (error) {
    console.error("\n❌ Destruction failed:", error);
    process.exit(1);
  }
}

// Helper function to format duration in a human-readable way
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

// Main CLI handler
const command = process.argv[2];

if (command === "up") {
  deployAllStacks();
} else if (command === "destroy") {
  destroyAllStacks();
} else {
  console.log("Usage: ts-node launcher.ts [up|destroy]");
  console.log("  up      - Deploy all stacks in order");
  console.log("  destroy - Destroy all stacks in reverse order");
  process.exit(1);
}
