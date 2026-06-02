import type { EnvironmentConfig } from "../types";

export function buildDefaultEnvironments(initialEnvs: string[], defaultKeys: string[]): EnvironmentConfig[] {
  return initialEnvs.map((name) => ({
    name,
    resource_name: "",
    resource_group: "",
    subscription_id: "",
    values: defaultKeys.map((key) => ({ key, value: "" }))
  }));
}

export function buildEnvironmentsFromTemplateConfig(
  templateEnvs: EnvironmentConfig[],
  keys: string[]
): EnvironmentConfig[] {
  return templateEnvs.map((env) => ({
    name: env.name,
    resource_name: env.resource_name ?? "",
    resource_group: env.resource_group ?? "",
    subscription_id: env.subscription_id ?? "",
    values: keys.map((key) => ({ key, value: "" }))
  }));
}
