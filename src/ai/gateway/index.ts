import { getCorrelationId } from "@/lib/correlation";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { redactInput } from "@/ai/gateway/redaction";
import type {
  AiGatewayInput,
  AiGatewayResult,
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

type RunAiGatewayOptions = {
  provider?: ProviderAdapter;
  featureFlagReader?: FeatureFlagReader;
};

export async function runAiGateway<T = unknown>(
  input: AiGatewayInput,
  options: RunAiGatewayOptions = {},
): Promise<AiGatewayResult<T>> {
  const correlationId = input.correlationId ?? (await getCorrelationId());
  const serverEnv = getServerEnv();
  const featureFlagReader =
    options.featureFlagReader ?? defaultFeatureFlagReader;

  const aiGlobalEnabled = await featureFlagReader("ai.global.enabled");
  const storeFlag =
    input.store ?? (input.classification === "sensitive" ? false : true);

  const unavailable = (): AiGatewayResult<T> => ({
    status: "unavailable",
    fallback: "manual",
    correlationId,
  });

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

    const supabase = await createClient();
    if (supabase && storeFlag) {
      await supabase.from("ai_runs").insert({
        use_case: input.useCase,
        status: "success",
        model_id: response.modelId,
        prompt_version: input.promptVersion,
        schema_version: input.schemaVersion,
        classification: input.classification,
        store_flag: storeFlag,
        usage: response.usage ?? {},
        correlation_id: correlationId,
        disposition: "completed",
      });
    }

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
