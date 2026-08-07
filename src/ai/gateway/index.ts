import { getCorrelationId } from "@/lib/correlation";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redactInput } from "@/ai/gateway/redaction";
import type {
  AiGatewayInput,
  AiGatewayResult,
  AiRunStatus,
  FeatureFlagReader,
  ProviderAdapter,
  ProviderRequest,
  ProviderResponse,
} from "@/ai/gateway/types";

export class DisabledProvider implements ProviderAdapter {
  readonly name = "disabled";

  isAvailable(): boolean {
    return false;
  }

  async run<T>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    throw new Error(`AI provider is disabled for ${request.useCase}.`);
  }
}

export class FakeProvider implements ProviderAdapter {
  readonly name = "fake";
  public callCount = 0;

  constructor(private readonly response: ProviderResponse = { output: { ok: true }, modelId: "fake-model" }) {}

  isAvailable(): boolean {
    return true;
  }

  async run<T>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    this.callCount += 1;
    logger.debug("FakeProvider.run", { useCase: request.useCase });
    return this.response as ProviderResponse<T>;
  }
}

async function defaultFeatureFlagReader(key: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) {
    return false;
  }

  const { data } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();

  return Boolean(data?.enabled);
}

type AiRunMetadata = {
  useCase: string;
  status: AiRunStatus | "failed";
  modelId?: string | null;
  promptVersion?: string;
  schemaVersion?: string;
  classification?: string;
  storeFlag: boolean;
  usage?: Record<string, unknown>;
  correlationId: string;
  disposition?: string;
  errorCode?: string | null;
};

type RunAiGatewayOptions = {
  provider?: ProviderAdapter;
  featureFlagReader?: FeatureFlagReader;
  /** Test seam: override metadata audit persistence. */
  recordAiRun?: (row: AiRunMetadata) => Promise<void>;
};

/**
 * Always attempt a metadata-only ai_runs insert — never store raw sensitive input.
 * Uses the service-role client when present; otherwise logs a warning and skips.
 */
async function persistAiRunMetadata(row: AiRunMetadata): Promise<void> {
  const admin = createAdminClientOrNull();
  if (!admin) {
    logger.warn("ai_runs metadata write skipped — service role unavailable", {
      useCase: row.useCase,
      status: row.status,
      correlationId: row.correlationId,
    });
    return;
  }

  const { error } = await admin.from("ai_runs").insert({
    use_case: row.useCase,
    status: row.status === "failed" ? "error" : row.status,
    model_id: row.modelId ?? null,
    prompt_version: row.promptVersion ?? null,
    schema_version: row.schemaVersion ?? null,
    classification: row.classification ?? null,
    store_flag: row.storeFlag,
    usage: row.usage ?? {},
    correlation_id: row.correlationId,
    disposition: row.disposition ?? null,
    error_code: row.errorCode ?? null,
  });

  if (error) {
    logger.error("ai_runs metadata write failed", {
      useCase: row.useCase,
      correlationId: row.correlationId,
      error: error.message,
    });
  }
}

export async function runAiGateway<T = unknown>(
  input: AiGatewayInput,
  options: RunAiGatewayOptions = {},
): Promise<AiGatewayResult<T>> {
  const correlationId = input.correlationId ?? (await getCorrelationId());
  const serverEnv = getServerEnv();
  const featureFlagReader =
    options.featureFlagReader ?? defaultFeatureFlagReader;
  const recordAiRun = options.recordAiRun ?? persistAiRunMetadata;

  const aiGlobalEnabled = await featureFlagReader("ai.global.enabled");
  const storeFlag =
    input.store ?? (input.classification === "sensitive" ? false : true);

  const baseMeta = {
    useCase: input.useCase,
    promptVersion: input.promptVersion,
    schemaVersion: input.schemaVersion,
    classification: input.classification,
    storeFlag,
    correlationId,
  };

  const unavailable = async (): Promise<AiGatewayResult<T>> => {
    await recordAiRun({
      ...baseMeta,
      status: "unavailable",
      disposition: "blocked",
    });
    return {
      status: "unavailable",
      fallback: "manual",
      correlationId,
    };
  };

  if (serverEnv.aiGlobalKillSwitch) {
    logger.info("AI Gateway blocked by kill switch", {
      useCase: input.useCase,
      correlationId,
    });
    return unavailable();
  }

  if (!aiGlobalEnabled) {
    logger.info("AI Gateway blocked by feature flag", {
      useCase: input.useCase,
      correlationId,
    });
    await recordAiRun({
      ...baseMeta,
      status: "disabled",
      disposition: "blocked",
    });
    return { status: "disabled", fallback: "manual", correlationId };
  }

  if (!serverEnv.openaiApiKey) {
    logger.info("AI Gateway unavailable — no OPENAI_API_KEY", {
      useCase: input.useCase,
      correlationId,
    });
    return unavailable();
  }

  const provider = options.provider ?? new DisabledProvider();

  if (!provider.isAvailable()) {
    return unavailable();
  }

  // Redact for provider call only — never persist raw input to ai_runs.
  const sanitizedInput = redactInput(input.input);

  try {
    const response = await provider.run<T>({
      useCase: input.useCase,
      modelId: "responses-api-stub",
      input: sanitizedInput,
      promptVersion: input.promptVersion,
      schemaVersion: input.schemaVersion,
      correlationId,
    });

    await recordAiRun({
      ...baseMeta,
      status: "success",
      modelId: response.modelId,
      usage: response.usage ?? {},
      disposition: "completed",
    });

    return {
      status: "success",
      output: response.output,
      correlationId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    logger.error("AI Gateway provider error", {
      useCase: input.useCase,
      correlationId,
      error: message,
    });

    await recordAiRun({
      ...baseMeta,
      status: "failed",
      disposition: "error",
      errorCode: "provider_error",
    });

    return {
      status: "error",
      fallback: "manual",
      errorCode: "provider_error",
      correlationId,
    };
  }
}

/**
 * Phase 1 boundary only. When credentials exist, wire OpenAI Responses API here
 * via fetch — do not import the openai SDK elsewhere in the app.
 */
export function createFetchProvider(apiKey: string): ProviderAdapter {
  return {
    name: "openai-responses-fetch",
    isAvailable() {
      return Boolean(apiKey);
    },
    async run<T>(request: ProviderRequest): Promise<ProviderResponse<T>> {
      getPublicEnv();
      logger.info("OpenAI Responses API adapter not yet implemented", {
        useCase: request.useCase,
      });
      throw new Error("OpenAI Responses API adapter not yet implemented.");
    },
  };
}
