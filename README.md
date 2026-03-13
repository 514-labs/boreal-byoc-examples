# Boreal Bring Your Own Cloud (BYOC) Examples

This repository contains example deployments and configurations for Bring Your Own Cloud (BYOC) setups using the Moose Deployment Service (MDS) tailored for Boreal environments.

## Overview

The purpose of this repo is to provide reference implementations and best practices for deploying Moose Deployment Service in a BYOC context. These examples illustrate how to configure, deploy, and manage MDS across different cloud providers and Boreal infrastructure.

## Contents

- Sample deployment manifests
- Configuration templates
- Scripts for setup and teardown
- Documentation on integration points and customizations

## Getting Started

1. Clone this repository:

   ```bash
   git clone https://github.com/your-org/boreal-byoc-examples.git
   cd boreal-byoc-examples
   ```

## Setting Up New Org Configurations

Each deployment requires organization-specific configuration files. Use the provided script to quickly generate new org configs from templates.

### Quick Setup

Navigate to the AWS deployment directory and run the config creation script:

```bash
cd pulumi/aws/managed-redis-managed-kafka-temporal-clickhouse

# Create new org configs
npm run create-config "Your Org Name" org_2qMFnk4YOm

# Or run directly
node create-config.js "Your Org Name" org_2qMFnk4YOm
```

**Arguments:**

- **Org Name**: The organization name (spaces will be converted to hyphens and lowercased)
- **Org ID**: The Boreal organization ID (mixed case format)

**What it does:**

- Creates a new directory in `config/` based on the processed org name
- Copies all example config files from `config/_example/`
- Replaces placeholders:
  - `YOUR_ORG_ID_LOWERCASE_HERE` → lowercase org ID
  - `YOUR_ORG_ID_MIXED_CASE_HERE` → mixed case org ID (as provided)
  - `YOUR_ORG_NAME_HERE` → processed org name (spaces → hyphens, lowercase)

**After creating configs:**

1. Review the generated files in `config/{your-org-name}/`
2. Update `YOUR_AWS_PROFILE_HERE` in `Pulumi.yaml` with your AWS profile name
3. Update `YOUR_IMAGE_TAG_HERE` in `Pulumi.mds.yaml` with the appropriate MDS image tag
4. Deploy using: `ORG={your-org-name} npm run deploy`

> **Note**: Config directories are excluded from git. Never commit actual customer configs to the repository.
