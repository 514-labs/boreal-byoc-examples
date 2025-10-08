#!/bin/bash
# From the azure/managed-redis-managed-event-bus-temporal-clickhouse directory

# Get subscription ID dynamically from Azure CLI
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Set resource group and cluster name (adjust these if needed)
RESOURCE_GROUP="${RESOURCE_GROUP:-boreal-byoc}"
CLUSTER_NAME="${CLUSTER_NAME:-boreal-byoc}"

# Construct the scope dynamically
SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ContainerService/managedClusters/${CLUSTER_NAME}"

az policy assignment update \
  --name "aks-deployment-safeguards-policy-assignment" \
  --scope "${SCOPE}" \
  --params "$(jq '.parameters' src/base/policy-config.json)" \
  --overrides "$(jq -c '.overrides' src/base/policy-config.json)"