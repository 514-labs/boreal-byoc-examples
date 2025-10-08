# From the azure/managed-redis-managed-event-bus-temporal-clickhouse directory
az policy assignment update \
  --name "aks-deployment-safeguards-policy-assignment" \
  --scope "/subscriptions/56eb22a1-7c1d-4931-b759-d56239ac31e7/resourceGroups/boreal-byoc/providers/Microsoft.ContainerService/managedClusters/boreal-byoc" \
  --params "$(jq '.parameters' src/base/policy-config.json)" \
  --overrides "$(jq -c '.overrides' src/base/policy-config.json)"