import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";
import { Command } from "commander";

const program = new Command();

// Validate config directory exists
function validateConfigDir(org: string): void {
  const configDir = path.join(process.cwd(), "config", org);
  const pulumiYamlPath = path.join(configDir, "Pulumi.yaml");

  if (!fs.existsSync(configDir)) {
    console.error(`Error: Config directory does not exist: ${configDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(pulumiYamlPath)) {
    console.error(`Error: Pulumi.yaml not found in: ${configDir}`);
    process.exit(1);
  }
}

// Copy Pulumi.yaml from config to project root
function copyPulumiYaml(org: string): string {
  const configDir = path.join(process.cwd(), "config", org);
  const sourcePath = path.join(configDir, "Pulumi.yaml");
  const destPath = path.join(process.cwd(), "Pulumi.yaml");

  fs.copyFileSync(sourcePath, destPath);
  return destPath;
}

// Remove Pulumi.yaml from project root
function removePulumiYaml(pulumiYamlPath: string): void {
  if (fs.existsSync(pulumiYamlPath)) {
    fs.unlinkSync(pulumiYamlPath);
  }
}

// Track current pulumi process for signal handling
let currentPulumiProcess: ReturnType<typeof spawn> | null = null;

// Execute pulumi cancel command
function executePulumiCancel(
  stackName: string,
  org: string,
  workDir: string
): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    const configFile = path.join("config", org, `Pulumi.${stackName}.yaml`);
    // Azure uses stack names without org prefix
    const fullStackName = stackName;

    const args = ["cancel", "--stack", fullStackName, "--yes", "--non-interactive"];

    console.log(`   🔄 Cancelling update for ${fullStackName}...`);

    const pulumiProcess = spawn("pulumi", args, {
      cwd: workDir,
      stdio: "inherit",
      shell: false,
    });

    pulumiProcess.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Pulumi cancel failed with exit code ${code}`));
      }
    });

    pulumiProcess.on("error", (error) => {
      reject(error);
    });
  });
}

// Execute pulumi CLI command
function executePulumiCommand(
  command: string,
  stackName: string,
  org: string,
  workDir: string
): Promise<{ success: boolean; duration: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const configFile = path.join("config", org, `Pulumi.${stackName}.yaml`);
    // Azure uses stack names without org prefix
    const fullStackName = stackName;

    const args = [
      command,
      "--stack",
      fullStackName,
      "--config-file",
      configFile,
      "--yes",
      "--non-interactive",
    ];

    if (command === "up") {
      args.push("--skip-preview"); // Skip preview for automation
    }

    console.log(`   🔄 Running 'pulumi ${command}' for ${fullStackName}...`);
    console.log(`   📁 Using config: ${configFile}`);

    const pulumiProcess = spawn("pulumi", args, {
      cwd: workDir,
      stdio: "inherit",
      shell: false,
    });

    // Track current process for signal handling
    currentPulumiProcess = pulumiProcess;

    pulumiProcess.on("close", (code, signal) => {
      currentPulumiProcess = null;
      const duration = (Date.now() - startTime) / 1000;
      if (code === 0) {
        resolve({ success: true, duration });
      } else if (signal) {
        // Process was terminated by signal
        reject(new Error(`Pulumi ${command} was terminated by signal: ${signal}`));
      } else {
        // Provide more helpful error messages for common exit codes
        let errorMessage = `Pulumi ${command} failed with exit code ${code}`;
        if (code === 255) {
          errorMessage += `\n   💡 Tip: This often indicates a conflict or state issue.`;
          errorMessage += `\n   Try: pulumi cancel --stack ${fullStackName}`;
          errorMessage += `\n   Or check for stuck updates: pulumi stack --stack ${fullStackName}`;
        }
        reject(new Error(errorMessage));
      }
    });

    pulumiProcess.on("error", (error) => {
      currentPulumiProcess = null;
      reject(error);
    });
  });
}

// Execute pulumi command with automatic conflict resolution
async function executePulumiCommandWithRetry(
  command: string,
  stackName: string,
  org: string,
  workDir: string
): Promise<{ success: boolean; duration: number }> {
  try {
    return await executePulumiCommand(command, stackName, org, workDir);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Check if this is a conflict error (exit code 255)
    if (errorMessage.includes("exit code 255") || errorMessage.includes("Conflict")) {
      console.log(`\n   ⚠️  Detected conflict - automatically cancelling stuck update...`);
      try {
        await executePulumiCancel(stackName, org, workDir);
        console.log(`   ✅ Cancelled stuck update, retrying ${command}...\n`);
        // Wait a moment for the cancellation to propagate
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Retry the original command
        return await executePulumiCommand(command, stackName, org, workDir);
      } catch (cancelError) {
        console.error(`   ❌ Failed to cancel stuck update:`, cancelError);
        throw error; // Throw original error if cancel fails
      }
    }
    // Re-throw non-conflict errors
    throw error;
  }
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

// Define all available stacks
const ALL_STACKS = [
  { name: "base", description: "VNet, AKS, and networking infrastructure" },
  {
    name: "byoc-services",
    description: "Redis, EventHubs, Temporal, and ClickHouse services",
  },
  { name: "datadog", description: "Datadog" },
  { name: "mds", description: "MDS - Moose Deployment Service" },
];

// Get stack info by name
function getStackInfo(stackName: string): { name: string; description: string } | undefined {
  return ALL_STACKS.find((s) => s.name === stackName);
}

// Validate stack name
function validateStackName(stackName: string): void {
  if (!getStackInfo(stackName)) {
    const validStacks = ALL_STACKS.map((s) => s.name).join(", ");
    console.error(`Error: Invalid stack name "${stackName}"`);
    console.error(`Valid stacks: ${validStacks}`);
    process.exit(1);
  }
}

async function deployStacks(org: string, stackName?: string) {
  const stacksToDeploy = stackName ? [getStackInfo(stackName)!] : ALL_STACKS;

  const stackLabel = stackName ? `stack "${stackName}"` : "all stacks";
  console.log(`🚀 Starting deployment of ${stackLabel} for org: ${org}...\n`);
  const overallStartTime = Date.now();

  // Validate config directory
  validateConfigDir(org);

  // Validate stack name if provided
  if (stackName) {
    validateStackName(stackName);
  }

  // Copy Pulumi.yaml to project root
  const pulumiYamlPath = copyPulumiYaml(org);
  console.log(`✓ Copied Pulumi.yaml from config/${org}/ to project root\n`);

  const workDir = process.cwd();

  // Set up signal handlers for graceful shutdown
  const signalHandler = (signal: NodeJS.Signals) => {
    console.log(`\n\n⚠️  Received ${signal}, shutting down gracefully...`);
    if (currentPulumiProcess) {
      console.log(`   Sending SIGTERM to pulumi process...`);
      currentPulumiProcess.kill("SIGTERM");
    }
    // Cleanup will happen in finally block
  };
  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);

  const stackTimings: { [key: string]: number } = {};

  try {
    for (const stackInfo of stacksToDeploy) {
      console.log(`\n📦 Deploying stack: ${stackInfo.name}`);
      console.log(`   ${stackInfo.description}`);
      console.log("   " + "=".repeat(50));

      try {
        const result = await executePulumiCommandWithRetry("up", stackInfo.name, org, workDir);
        stackTimings[stackInfo.name] = result.duration;

        console.log(`\n   ✅ Stack ${stackInfo.name} deployed successfully!`);
        console.log(`   ⏱️  Time: ${formatDuration(result.duration)}`);
      } catch (error) {
        console.error(`\n   ❌ Failed to deploy stack ${stackInfo.name}:`, error);
        throw error;
      }
    }

    const overallEndTime = Date.now();
    const overallDuration = (overallEndTime - overallStartTime) / 1000;

    const successMessage = stackName
      ? `🎉 Stack ${stackName} deployed successfully!`
      : `🎉 All stacks deployed successfully!`;
    console.log(`\n\n${successMessage}`);
    console.log("\n📋 Stack deployment summary:");
    for (const stackInfo of stacksToDeploy) {
      const duration = stackTimings[stackInfo.name];
      console.log(`   ✓ ${stackInfo.name}: Deployed in ${formatDuration(duration)}`);
    }
    console.log(`\n⏱️  Total deployment time: ${formatDuration(overallDuration)}`);
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  } finally {
    // Remove signal handlers
    process.removeListener("SIGINT", signalHandler);
    process.removeListener("SIGTERM", signalHandler);
    // Always cleanup Pulumi.yaml
    removePulumiYaml(pulumiYamlPath);
    console.log(`\n✓ Cleaned up Pulumi.yaml from project root`);
  }
}

async function destroyStacks(org: string, stackName?: string) {
  // If specific stack, use it; otherwise use reverse order for all stacks
  const stacksToDestroy = stackName ? [getStackInfo(stackName)!] : [...ALL_STACKS].reverse();

  const stackLabel = stackName ? `stack "${stackName}"` : "all stacks";
  console.log(`🗑️  Starting destruction of ${stackLabel} for org: ${org}...\n`);
  if (!stackName) {
    console.log("⚠️  WARNING: This will destroy all resources in reverse order!\n");
  }
  const overallStartTime = Date.now();

  // Validate config directory
  validateConfigDir(org);

  // Validate stack name if provided
  if (stackName) {
    validateStackName(stackName);
  }

  // Copy Pulumi.yaml to project root
  const pulumiYamlPath = copyPulumiYaml(org);
  console.log(`✓ Copied Pulumi.yaml from config/${org}/ to project root\n`);

  const workDir = process.cwd();

  // Set up signal handlers for graceful shutdown
  const signalHandler = (signal: NodeJS.Signals) => {
    console.log(`\n\n⚠️  Received ${signal}, shutting down gracefully...`);
    if (currentPulumiProcess) {
      console.log(`   Sending SIGTERM to pulumi process...`);
      currentPulumiProcess.kill("SIGTERM");
    }
    // Cleanup will happen in finally block
  };
  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);

  const stackTimings: { [key: string]: number } = {};

  try {
    for (const stackInfo of stacksToDestroy) {
      console.log(`\n🗑️  Destroying stack: ${stackInfo.name}`);
      console.log(`   ${stackInfo.description}`);
      console.log("   " + "=".repeat(50));

      try {
        const result = await executePulumiCommandWithRetry("destroy", stackInfo.name, org, workDir);
        stackTimings[stackInfo.name] = result.duration;

        console.log(`\n   ✅ Stack ${stackInfo.name} destroyed successfully!`);
        console.log(`   ⏱️  Time: ${formatDuration(result.duration)}`);
      } catch (error) {
        console.error(`\n   ❌ Failed to destroy stack ${stackInfo.name}:`, error);
        throw error;
      }
    }

    const overallEndTime = Date.now();
    const overallDuration = (overallEndTime - overallStartTime) / 1000;

    const successMessage = stackName
      ? `✅ Stack ${stackName} destroyed successfully!`
      : `✅ All stacks destroyed successfully!`;
    console.log(`\n\n${successMessage}`);
    console.log("\n📋 Stack destruction summary:");
    for (const stackInfo of stacksToDestroy) {
      const duration = stackTimings[stackInfo.name];
      console.log(`   ✓ ${stackInfo.name}: Destroyed in ${formatDuration(duration)}`);
    }
    console.log(`\n⏱️  Total destruction time: ${formatDuration(overallDuration)}`);
  } catch (error) {
    console.error("\n❌ Destruction failed:", error);
    throw error;
  } finally {
    // Remove signal handlers
    process.removeListener("SIGINT", signalHandler);
    process.removeListener("SIGTERM", signalHandler);
    // Always cleanup Pulumi.yaml
    removePulumiYaml(pulumiYamlPath);
    console.log(`\n✓ Cleaned up Pulumi.yaml from project root`);
  }
}

async function cancelStacks(org: string, stackName?: string) {
  const stacksToCancel = stackName ? [getStackInfo(stackName)!] : ALL_STACKS;

  const stackLabel = stackName ? `stack "${stackName}"` : "all stacks";
  console.log(`🚫 Cancelling in-progress updates for ${stackLabel} in org: ${org}...\n`);

  // Validate config directory
  validateConfigDir(org);

  // Validate stack name if provided
  if (stackName) {
    validateStackName(stackName);
  }

  // Copy Pulumi.yaml to project root
  const pulumiYamlPath = copyPulumiYaml(org);
  console.log(`✓ Copied Pulumi.yaml from config/${org}/ to project root\n`);

  const workDir = process.cwd();

  try {
    for (const stackInfo of stacksToCancel) {
      console.log(`\n🚫 Cancelling stack: ${stackInfo.name}`);
      console.log("   " + "=".repeat(50));

      try {
        await executePulumiCancel(stackInfo.name, org, workDir);
        console.log(`\n   ✅ Stack ${stackInfo.name} cancelled successfully!`);
      } catch (error) {
        console.error(`\n   ⚠️  Failed to cancel stack ${stackInfo.name}:`, error);
        // Continue with other stacks even if one fails
      }
    }

    console.log(`\n\n✅ Cancellation complete!`);
  } catch (error) {
    console.error("\n❌ Cancellation failed:", error);
    throw error;
  } finally {
    // Always cleanup Pulumi.yaml
    removePulumiYaml(pulumiYamlPath);
    console.log(`\n✓ Cleaned up Pulumi.yaml from project root`);
  }
}

// Set up commander CLI
program
  .name("launcher")
  .description("Deploy, destroy, or cancel Pulumi stacks for a given org")
  .version("1.0.0");

program
  .command("up")
  .description("Deploy stacks (all stacks if --stack not specified)")
  .requiredOption("--org <org-name>", "Organization name (config directory)")
  .option("--stack <stack-name>", "Specific stack to deploy (base, byoc-services, datadog, mds)")
  .action(async (options: { org: string; stack?: string }) => {
    try {
      await deployStacks(options.org, options.stack);
    } catch (error) {
      console.error("Fatal error:", error);
      process.exit(1);
    }
  });

program
  .command("destroy")
  .description("Destroy stacks (all stacks in reverse order if --stack not specified)")
  .requiredOption("--org <org-name>", "Organization name (config directory)")
  .option("--stack <stack-name>", "Specific stack to destroy (base, byoc-services, datadog, mds)")
  .action(async (options: { org: string; stack?: string }) => {
    try {
      await destroyStacks(options.org, options.stack);
    } catch (error) {
      console.error("Fatal error:", error);
      process.exit(1);
    }
  });

program
  .command("cancel")
  .description("Cancel in-progress updates for stacks")
  .requiredOption("--org <org-name>", "Organization name (config directory)")
  .option("--stack <stack-name>", "Specific stack to cancel (base, byoc-services, datadog, mds)")
  .action(async (options: { org: string; stack?: string }) => {
    try {
      await cancelStacks(options.org, options.stack);
    } catch (error) {
      console.error("Fatal error:", error);
      process.exit(1);
    }
  });

program.parse();
