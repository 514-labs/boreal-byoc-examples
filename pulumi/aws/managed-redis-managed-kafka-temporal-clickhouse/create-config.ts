#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error("Usage: npx tsx create-config.ts <org-name> <org-id>");
  console.error('Example: npx tsx create-config.ts "My Org Name" org_2qMFnk4YOm');
  process.exit(1);
}

const orgName = args[0];
const orgId = args[1];

// Process org name: trim, replace spaces with hyphens, and convert to lowercase
const processedOrgName = orgName.trim().replace(/\s+/g, "-").toLowerCase();

// Process org id: create lowercase version
const orgIdLowercase = orgId.toLowerCase();
const orgIdMixedCase = orgId; // Keep as-is (mixed case)

// Define paths
const configDir = path.join(process.cwd(), "config");
const exampleDir = path.join(configDir, "_example");
const targetDir = path.join(configDir, processedOrgName);

// Check if target directory already exists
if (fs.existsSync(targetDir)) {
  console.error(`Error: Config directory already exists: ${targetDir}`);
  process.exit(1);
}

// Create target directory
fs.mkdirSync(targetDir, { recursive: true });

// List of config files to copy
const configFiles = [
  "Pulumi.yaml",
  "Pulumi.base.yaml",
  "Pulumi.byoc-services.yaml",
  "Pulumi.datadog.yaml",
  "Pulumi.mds.yaml",
];

// Replacement mappings
const replacements = [
  { from: "YOUR_ORG_ID_LOWERCASE_HERE", to: orgIdLowercase },
  { from: "YOUR_ORG_ID_MIXED_CASE_HERE", to: orgIdMixedCase },
  { from: "YOUR_ORG_NAME_HERE", to: processedOrgName },
];

// Copy and process each file
configFiles.forEach((file) => {
  const sourcePath = path.join(exampleDir, file);
  const targetPath = path.join(targetDir, file);

  if (!fs.existsSync(sourcePath)) {
    console.warn(`Warning: Source file not found: ${sourcePath}`);
    return;
  }

  // Read source file
  let content = fs.readFileSync(sourcePath, "utf8");

  // Apply replacements
  replacements.forEach(({ from, to }) => {
    content = content.replace(new RegExp(from, "g"), to);
  });

  // Write to target file
  fs.writeFileSync(targetPath, content, "utf8");
  console.log(`Created: ${targetPath}`);
});

console.log(`\n✓ Successfully created config directory: ${targetDir}`);
console.log(`\nNext steps:`);
console.log(`1. Review the generated config files`);
console.log(`2. Update YOUR_AWS_PROFILE_HERE in Pulumi.yaml if needed`);
console.log(`3. Update YOUR_IMAGE_TAG_HERE in Pulumi.mds.yaml if needed`);
console.log(`4. Set environment variables:`);
console.log(`   export PULUMI_ORG=your-pulumi-org`);
console.log(`   export ORG=${processedOrgName}`);
console.log(`5. Deploy with: npm run deploy`);
