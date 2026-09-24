import { AiError, type AiChatMessage, type AiUsage, type ChatToolsResult, type ToolCall, type ToolSpec } from './types';

/**
 * THE CLAUDE WIRE FORMAT, as pure functions. `toAnthropicBody` turns our
 * provider-neutral messages into a Messages API request (system blocks,
 * user / assistant turns, `tool_use` + `tool_result` blocks, image blocks)
 * and `parseAnthropicResponse` reads the reply back. No fetch here, no
 * store, no native modules: the transport, the live eval runner and the
 * unit tests all share exactly this code.
 *
 * Prompt caching: the static head of the system prompt is marked
 * `cache_control: ephemeral`. Claude caches the prefix tools → system, so
 * every call after the first reads the ~9K tokens of tool schemas and
 * rules from cache at a tenth of the price and with lower latency.
 */

export const ANTHROPIC_VERSION = '2023-06-01';

interface TextBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}
interface ImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: 'image/jpeg'; data: string };
}
interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}
type Block = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: Block[];
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicBodyOptions {
  model: string;
  maxTokens: number;
  temperature?: number;
  tools?: ToolSpec[];
  /** Ask for a bare JSON object (Claude has no response_format; a system line does it). */
  json?: boolean;
}

/** Our ToolSpec is already JSON Schema; Claude just names the field differently. */
export function toAnthropicTools(tools: readonly ToolSpec[]): AnthropicTool[] {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: { ...t.parameters, type: 'object' } }));
}

/**
 * System messages → system blocks. A system message may name how many of its
 * leading characters are static (`cachePrefixChars`); that head becomes its
 * own cached block and the per-turn tail follows uncached.
 */
function systemBlocks(messages: AiChatMessage[], json: boolean | undefined): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const m of messages) {
    if (m.role !== 'system' || !m.content) continue;
    const n = m.cachePrefixChars ?? 0;
    if (n > 0 && n < m.content.length) {
      blocks.push({ type: 'text', text: m.content.slice(0, n), cache_control: { type: 'ephemeral' } });
      blocks.push({ type: 'text', text: m.content.slice(n) });
    } else {
      blocks.push({ type: 'text', text: m.content });
    }
  }
  if (json) blocks.push({ type: 'text', text: 'Respond with ONE JSON object and nothing else: no prose, no markdown fences.' });
  return blocks;
}

/** Conversation messages → alternating user / assistant turns with content blocks. */
export function toAnthropicMessages(messages: AiChatMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  const push = (role: 'user' | 'assistant', blocks: Block[]) => {
    if (blocks.length === 0) return;
    const last = out[out.length - 1];
    // Tool results for one assistant turn must arrive in ONE user message;
    // consecutive same-role turns are merged the same way.
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    switch (m.role) {
      case 'system':
        break;
      case 'user': {
        const blocks: Block[] = [];
        for (const b64 of m.images ?? []) blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
        const text = m.content || (m.images?.length ? 'See the attached image.' : '');
        if (text) blocks.push({ type: 'text', text });
        push('user', blocks);
        break;
      }
      case 'assistant': {
        const blocks: Block[] = [];
        if (m.content && m.content.trim()) blocks.push({ type: 'text', text: m.content });
        for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args ?? {} });
        // Claude rejects an empty assistant turn; a blank one carries nothing anyway.
        push('assistant', blocks);
        break;
      }
      case 'tool':
        push('user', [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }]);
        break;
    }
  }
  // The first turn must be the user's.
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/** The full request body for `POST /v1/messages`. */
export function toAnthropicBody(messages: AiChatMessage[], o: AnthropicBodyOptions): Record<string, unknown> {
  const system = systemBlocks(messages, o.json);
  const body: Record<string, unknown> = {
    model: o.model,
    max_tokens: o.maxTokens,
    messages: toAnthropicMessages(messages),
  };
  if (system.length) body.system = system;
  if (o.temperature !== undefined) body.temperature = Math.min(1, Math.max(0, o.temperature));
  if (o.tools?.length) {
    body.tools = toAnthropicTools(o.tools);
    body.tool_choice = { type: 'auto' };
  }
  return body;
}

interface AnthropicResponse {
  type?: string;
  content?: { type?: string; text?: string; id?: string; name?: string; input?: unknown }[];
  stop_reason?: string | null;
  error?: { type?: string; message?: string };
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

export interface ParsedAnthropic extends ChatToolsResult {
  stopReason: string | null;
}

/** The gateway's usage block → our shape; cache figures only when the gateway sends them. */
function toUsage(u: AnthropicResponse['usage']): AiUsage | undefined {
  if (!u || typeof u.input_tokens !== 'number') return undefined;
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens ?? 0,
    ...(typeof u.cache_read_input_tokens === 'number' ? { cacheReadTokens: u.cache_read_input_tokens } : {}),
    ...(typeof u.cache_creation_input_tokens === 'number' ? { cacheWriteTokens: u.cache_creation_input_tokens } : {}),
  };
}

/** Text + tool calls out of a Messages API reply. Throws a coded AiError on an error envelope. */
export function parseAnthropicResponse(data: unknown): ParsedAnthropic {
  const r = (data ?? {}) as AnthropicResponse;
  if (r.type === 'error' || r.error) {
    const t = r.error?.type ?? '';
    const msg = (r.error?.message ?? 'error').slice(0, 200);
    if (t === 'authentication_error' || t === 'permission_error') throw new AiError('badkey', msg);
    if (t === 'rate_limit_error') throw new AiError('quota', msg);
    throw new AiError('failed', msg);
  }
  const blocks = Array.isArray(r.content) ? r.content : [];
  const text = blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
    .trim();
  const toolCalls: ToolCall[] = blocks
    .filter((b) => b.type === 'tool_use' && typeof b.name === 'string')
    .map((b, i) => ({
      id: typeof b.id === 'string' ? b.id : `toolu_${i}`,
      name: b.name as string,
      args: b.input && typeof b.input === 'object' ? (b.input as Record<string, unknown>) : {},
    }));
  if (r.stop_reason === 'refusal') throw new AiError('failed', 'the model declined to answer');
  return { content: text || null, toolCalls, stopReason: r.stop_reason ?? null, usage: toUsage(r.usage) };
}

/** Headers for a direct call to Claude (or an Anthropic-shaped gateway such as MWAPI). */
export function anthropicHeaders(apiKey: string | null, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'anthropic-version': ANTHROPIC_VERSION,
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...extra,
  };
}
