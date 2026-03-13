import * as pulumi from "@pulumi/pulumi";
import { createDatadog } from "./src/datadog";

async function main() {
  const config = new pulumi.Config();
  const apiKey = config.requireSecret("datadogApiKey");
  const appKey = config.requireSecret("datadogAppKey");
  const rawClusterName = config.require("datadogClusterName");

  // Sanitize the cluster name to meet Datadog's requirements
  // Example: "boreal-org_31F5g5I5ej5jdwH4xEvLx1CBzEN" -> "boreal-org-31f5g5i5ej5jdwh4xevlx1cbzen"
  const clusterName = sanitizeClusterName(rawClusterName);

  // Log the transformation for visibility
  pulumi.log.info(`Datadog cluster name: ${rawClusterName} -> ${clusterName}`);

  createDatadog(clusterName, apiKey, appKey);
}

/**
 * Sanitizes a cluster name to conform to Datadog's requirements:
 * - Must be dot-separated tokens
 * - Each token must start with a lowercase letter
 * - Can only contain lowercase letters, numbers, or hyphens
 * - Must end with a letter or number
 * - Must be below 80 characters
 */
function sanitizeClusterName(name: string): string {
  // Replace underscores with hyphens and convert to lowercase
  let sanitized = name.toLowerCase().replace(/_/g, "-");

  // Ensure it starts with a letter
  if (!/^[a-z]/.test(sanitized)) {
    sanitized = "c" + sanitized;
  }

  // Remove any invalid characters (keep only letters, numbers, hyphens, and dots)
  sanitized = sanitized.replace(/[^a-z0-9\-\.]/g, "");

  // Ensure it ends with a letter or number
  sanitized = sanitized.replace(/[\-\.]+$/, "");

  // Ensure each token starts with a letter and doesn't have consecutive hyphens/dots
  sanitized = sanitized.replace(/[\-\.]+/g, "-");

  // Truncate to 79 characters to ensure it's below 80
  if (sanitized.length > 79) {
    sanitized = sanitized.substring(0, 79);
    // Ensure it still ends with a letter or number after truncation
    sanitized = sanitized.replace(/[\-\.]+$/, "");
  }

  return sanitized;
}

export { main };
