import type { AiChatMessage, AiUsage, ChatToolsResult, ToolCall, ToolSpec } from './types';

/**
 * THE OPENAI CHAT-COMPLETIONS WIRE FORMAT, as pure functions. Used for
 * OpenAI itself and as the fallback shape for Claude gateways: MWAPI's
 * Anthropic route drops a `tool_use` block whose input is `{}` (the reply
 * comes back with `stop_reason: tool_use` and an empty `content`), while its
 * `/chat/completions` route returns the same call intact.
 */

export interface OaMessage {
  role: string;
  content: unknown;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}

export interface OaResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
    };
    finish_reason?: string;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
  error?: { message?: string };
}

export function toOpenAiMessages(messages: AiChatMessage[]): OaMessage[] {
  return messages.map((m) => {
    switch (m.role) {
      case 'assistant':
        return {
          role: 'assistant',
          content: m.content ?? '',
          ...(m.toolCalls?.length
            ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
            : {}),
        };
      case 'tool':
        return { role: 'tool', tool_call_id: m.toolCallId, name: m.name, content: m.content };
      case 'user':
        if (m.images?.length) {
          return {
            role: 'user',
            content: [{ type: 'text', text: m.content || 'See the attached image.' }, ...m.images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }))],
          };
        }
        return { role: 'user', content: m.content };
      default:
        return { role: 'system', content: m.content };
    }
  });
}

export const toOpenAiTools = (tools: readonly ToolSpec[]) => tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));

export interface OpenAiBodyOptions {
  model: string;
  maxTokens: number;
  temperature?: number;
  tools?: ToolSpec[];
  json?: boolean;
}

/** The request body for `POST /chat/completions` (no provider quirks applied). */
export function toOpenAiBody(messages: AiChatMessage[], o: OpenAiBodyOptions): Record<string, unknown> {
  return {
    model: o.model,
    messages: toOpenAiMessages(messages),
    max_tokens: o.maxTokens,
    ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
    ...(o.json ? { response_format: { type: 'json_object' } } : {}),
    ...(o.tools?.length ? { tools: toOpenAiTools(o.tools), tool_choice: 'auto' } : {}),
  };
}

const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const v = JSON.parse(raw) as unknown;
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
};

export const openAiUsage = (u: OaResponse['usage']): AiUsage | undefined =>
  u && typeof u.prompt_tokens === 'number'
    ? { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens ?? 0, ...(typeof u.prompt_tokens_details?.cached_tokens === 'number' ? { cacheReadTokens: u.prompt_tokens_details.cached_tokens } : {}) }
    : undefined;

/** Text + tool calls out of a chat-completions reply. Returns null when there is no message at all. */
export function parseOpenAiResponse(data: unknown): ChatToolsResult | null {
  const r = (data ?? {}) as OaResponse;
  const msg = r.choices?.[0]?.message;
  if (!msg) return null;
  const toolCalls: ToolCall[] = (msg.tool_calls ?? [])
    .filter((c) => c.function?.name)
    .map((c, i) => ({ id: c.id ?? `call_${i}`, name: c.function!.name!, args: parseArgs(c.function!.arguments) }));
  return { content: typeof msg.content === 'string' && msg.content.trim() ? msg.content : null, toolCalls, usage: openAiUsage(r.usage) };
}

/** The failure signature of a gateway that lost the tool block: it says tool_use but sent nothing. */
export const lostToolCall = (r: { content: string | null; toolCalls: ToolCall[]; stopReason: string | null }): boolean => r.stopReason === 'tool_use' && r.toolCalls.length === 0;
