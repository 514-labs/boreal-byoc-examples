import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export function createPriorityClasses() {
  const priorityClasses = [
    {
      name: "moose-warmup",
      value: 0,
      preemptionPolicy: "Never",
      globalDefault: false,
      description:
        "Placeholder Pod priority - lowest priority, can be evicted by higher priority pods.",
    },
    {
      name: "moose-default",
      value: 100,
      preemptionPolicy: "PreemptLowerPriority",
      globalDefault: false,
      description: "Moose default priority. Will preempt the placeholder Pods.",
    },
  ];

  priorityClasses.forEach((priorityClass) => {
    new k8s.scheduling.v1.PriorityClass(priorityClass.name, {
      metadata: {
        name: priorityClass.name,
      },
      value: priorityClass.value,
      globalDefault: priorityClass.globalDefault,
      preemptionPolicy: priorityClass.preemptionPolicy,
      description: priorityClass.description,
    });
  });
}
