export type AiClassification = "public" | "internal" | "sensitive";

export type AiRunStatus =
  | "unavailable"
  | "disabled"
  | "success"
  | "error"
  | "validation_error";

export type AiGatewayInput = {
  useCase: string;
  classification: AiClassification;
  schema: string;
  input: Record<string, unknown>;
  promptVersion: string;
  schemaVersion: string;
  correlationId?: string;
  store?: boolean;
};

export type AiGatewayResult<T = unknown> = {
  status: AiRunStatus;
  fallback?: "manual";
  output?: T;
  errorCode?: string;
  correlationId?: string;
};

export type ProviderRequest = {
  useCase: string;
  modelId: string;
  input: Record<string, unknown>;
  promptVersion: string;
  schemaVersion: string;
  correlationId: string;
};

export type ProviderResponse<T = unknown> = {
  output: T;
  usage?: Record<string, unknown>;
  modelId: string;
};

export interface ProviderAdapter {
  readonly name: string;
  isAvailable(): boolean;
  run<T>(request: ProviderRequest): Promise<ProviderResponse<T>>;
}

export type FeatureFlagReader = (key: string) => Promise<boolean>;
