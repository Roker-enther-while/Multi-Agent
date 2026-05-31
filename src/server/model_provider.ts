export type ProviderType = "mock" | "openai_compatible" | "anthropic" | "gemini" | "ollama" | "lmstudio";

export interface ModelConfig {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export interface ModelResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface ModelProvider {
  readonly name: string;
  readonly isAvailable: boolean;
  generate(prompt: string): Promise<ModelResponse>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

export function loadModelConfig(): ModelConfig {
  return {
    provider: (process.env.MODEL_PROVIDER as ProviderType) || "mock",
    baseUrl: process.env.MODEL_BASE_URL || "",
    apiKey: process.env.MODEL_API_KEY || "",
    modelName: process.env.MODEL_NAME || "mock-model",
    temperature: parseFloat(process.env.MODEL_TEMPERATURE || "0.2"),
    maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || "4096", 10),
  };
}

export function createProvider(config: ModelConfig): ModelProvider {
  switch (config.provider) {
    case "mock":
      return new MockProvider();
    case "openai_compatible":
      return new OpenAICompatibleProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "lmstudio":
      return new LMStudioProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    default:
      return new MockProvider();
  }
}

class MockProvider implements ModelProvider {
  public readonly name = "mock";
  public readonly isAvailable = true;

  public async generate(prompt: string): Promise<ModelResponse> {
    return {
      content: `[Mock response for: ${prompt.slice(0, 80)}...]`,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock provider always available" };
  }
}

class OpenAICompatibleProvider implements ModelProvider {
  public readonly name = "openai_compatible";
  public readonly isAvailable: boolean;
  private readonly config: ModelConfig;

  public constructor(config: ModelConfig) {
    this.config = config;
    this.isAvailable = Boolean(config.baseUrl && config.apiKey);
  }

  public async generate(prompt: string): Promise<ModelResponse> {
    if (!this.isAvailable) throw new Error("Provider not configured: missing baseUrl or apiKey");
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return { content: data.choices[0]?.message?.content || "" };
  }

  public async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isAvailable) return { ok: false, message: "Missing baseUrl or apiKey" };
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      return response.ok
        ? { ok: true, message: "Connected" }
        : { ok: false, message: `HTTP ${response.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  }
}

class AnthropicProvider implements ModelProvider {
  public readonly name = "anthropic";
  public readonly isAvailable: boolean;
  private readonly config: ModelConfig;

  public constructor(config: ModelConfig) {
    this.config = config;
    this.isAvailable = Boolean(config.apiKey);
  }

  public async generate(prompt: string): Promise<ModelResponse> {
    if (!this.isAvailable) throw new Error("Provider not configured: missing apiKey");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.modelName || "claude-sonnet-4-20250514",
        max_tokens: this.config.maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
    const data = (await response.json()) as { content: Array<{ text: string }> };
    return { content: data.content[0]?.text || "" };
  }

  public async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isAvailable) return { ok: false, message: "Missing apiKey" };
    return { ok: true, message: "API key configured (connection not tested)" };
  }
}

class OllamaProvider implements ModelProvider {
  public readonly name: string = "ollama";
  public readonly isAvailable: boolean;
  private readonly config: ModelConfig;

  public constructor(config: ModelConfig) {
    this.config = config;
    this.isAvailable = Boolean(config.baseUrl);
  }

  public async generate(prompt: string): Promise<ModelResponse> {
    if (!this.isAvailable) throw new Error("Provider not configured: missing baseUrl");
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.modelName || "llama3",
        prompt,
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
    const data = (await response.json()) as { response: string };
    return { content: data.response || "" };
  }

  public async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isAvailable) return { ok: false, message: "Missing baseUrl" };
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      return response.ok ? { ok: true, message: "Connected" } : { ok: false, message: `HTTP ${response.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  }
}

class LMStudioProvider extends OllamaProvider {
  public readonly name = "lmstudio";
}

class GeminiProvider implements ModelProvider {
  public readonly name = "gemini";
  public readonly isAvailable: boolean;
  private readonly config: ModelConfig;

  public constructor(config: ModelConfig) {
    this.config = config;
    this.isAvailable = Boolean(config.apiKey);
  }

  public async generate(prompt: string): Promise<ModelResponse> {
    if (!this.isAvailable) throw new Error("Provider not configured: missing apiKey");
    const model = this.config.modelName || "gemini-pro";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
          },
        }),
      }
    );
    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = (await response.json()) as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
    return { content: data.candidates[0]?.content?.parts[0]?.text || "" };
  }

  public async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isAvailable) return { ok: false, message: "Missing apiKey" };
    return { ok: true, message: "API key configured (connection not tested)" };
  }
}
