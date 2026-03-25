import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface ClickHouseOtelCollectorArgs {
  namespace: string;
  clickhouseServiceName: string;
  metricsPort: number;
  releaseOpts: pulumi.CustomResourceOptions;
}

export function createClickHouseOtelCollector(
  args: ClickHouseOtelCollectorArgs
): k8s.apiextensions.CustomResource {
  const target = `${args.clickhouseServiceName}.${args.namespace}.svc.cluster.local:${args.metricsPort}`;

  const collectorConfig = `
receivers:
  prometheus:
    config:
      scrape_configs:
        - job_name: clickhouse
          scrape_interval: 30s
          static_configs:
            - targets:
              - '${target}'
          metric_relabel_configs:
            - source_labels: [__name__]
              regex: 'ClickHouseProfileEvents_InitialQuery|ClickHouseProfileEvents_Query|ClickHouseProfileEvents_SelectQuery|ClickHouseProfileEvents_InsertQuery|ClickHouseProfileEvents_OSCPUWaitMicroseconds|ClickHouseAsyncMetrics_Uptime|ClickHouse_ServiceInfo'
              action: keep

processors:
  batch:
    timeout: 30s
    send_batch_size: 1024
  resource:
    attributes:
      - key: service.name
        value: clickhouse
        action: upsert

exporters:
  otlphttp:
    endpoint: "http://\${env:NODE_IP}:4318"

service:
  pipelines:
    metrics:
      receivers: [prometheus]
      processors: [resource, batch]
      exporters: [otlphttp]
`;

  return new k8s.apiextensions.CustomResource(
    "clickhouse-otel-collector",
    {
      apiVersion: "opentelemetry.io/v1beta1",
      kind: "OpenTelemetryCollector",
      metadata: {
        name: "clickhouse-metrics",
        namespace: args.namespace,
      },
      spec: {
        mode: "deployment",
        replicas: 1,
        env: [
          {
            name: "NODE_IP",
            valueFrom: {
              fieldRef: {
                fieldPath: "status.hostIP",
              },
            },
          },
        ],
        config: collectorConfig,
        resources: {
          requests: { cpu: "50m", memory: "64Mi" },
          limits: { cpu: "200m", memory: "256Mi" },
        },
      },
    },
    args.releaseOpts
  );
}
