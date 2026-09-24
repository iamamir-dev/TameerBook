import { describe, expect, it } from 'vitest';

import { parseAnthropicResponse, toAnthropicBody, toAnthropicMessages, toAnthropicTools } from './anthropic';
import type { AiChatMessage, ToolSpec } from './types';

const tools: ToolSpec[] = [{ name: 'get_cash', description: 'Cash now', parameters: { type: 'object', properties: { account: { type: 'string' } }, required: [] } }];

describe('toAnthropicBody', () => {
  it('splits the system prompt into a cached static head and an uncached tail', () => {
    const head = 'STATIC RULES '.repeat(20);
    const body = toAnthropicBody([{ role: 'system', content: `${head}TODAY 2026-09-24`, cachePrefixChars: head.length }, { role: 'user', content: 'hi' }], { model: 'claude-sonnet-4-6', maxTokens: 100 });
    const system = body.system as { text: string; cache_control?: unknown }[];
    expect(system).toHaveLength(2);
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(system[0].text).toBe(head);
    expect(system[1].text).toBe('TODAY 2026-09-24');
    expect(system[1].cache_control).toBeUndefined();
  });

  it('renames parameters to input_schema and sets tool_choice auto', () => {
    const body = toAnthropicBody([{ role: 'user', content: 'cash?' }], { model: 'm', maxTokens: 10, tools });
    expect(toAnthropicTools(tools)[0].input_schema).toMatchObject({ type: 'object' });
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toEqual({ type: 'auto' });
    expect(body.system).toBeUndefined();
  });

  it('clamps temperature into Claude\'s 0..1 range and adds a JSON instruction on request', () => {
    const body = toAnthropicBody([{ role: 'user', content: 'x' }], { model: 'm', maxTokens: 10, temperature: 1.5, json: true });
    expect(body.temperature).toBe(1);
    const system = body.system as { text: string }[];
    expect(system[0].text).toContain('JSON');
  });
});

describe('toAnthropicMessages', () => {
  it('turns tool calls and results into tool_use / tool_result blocks, results merged into one user turn', () => {
    const messages: AiChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'cash and orders' },
      {
        role: 'assistant',
        content: 'Checking.',
        toolCalls: [
          { id: 'tu_1', name: 'get_cash', args: {} },
          { id: 'tu_2', name: 'get_orders', args: { status: 'pending' } },
        ],
      },
      { role: 'tool', toolCallId: 'tu_1', name: 'get_cash', content: '{"cash":1}' },
      { role: 'tool', toolCallId: 'tu_2', name: 'get_orders', content: '{"orders":2}' },
    ];
    const out = toAnthropicMessages(messages);
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(out[1].content).toEqual([
      { type: 'text', text: 'Checking.' },
      { type: 'tool_use', id: 'tu_1', name: 'get_cash', input: {} },
      { type: 'tool_use', id: 'tu_2', name: 'get_orders', input: { status: 'pending' } },
    ]);
    expect(out[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'tu_1', content: '{"cash":1}' },
      { type: 'tool_result', tool_use_id: 'tu_2', content: '{"orders":2}' },
    ]);
  });

  it('puts images before the text and drops an empty assistant turn', () => {
    const out = toAnthropicMessages([
      { role: 'user', content: '', images: ['AAAA'] },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'and?' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].content[0]).toMatchObject({ type: 'image', source: { data: 'AAAA', media_type: 'image/jpeg' } });
    expect(out[0].content[1]).toEqual({ type: 'text', text: 'See the attached image.' });
    expect(out[0].content[2]).toEqual({ type: 'text', text: 'and?' });
  });

  it('never starts with an assistant turn', () => {
    const out = toAnthropicMessages([{ role: 'assistant', content: 'stale' }, { role: 'user', content: 'hi' }]);
    expect(out[0].role).toBe('user');
  });
});

describe('parseAnthropicResponse', () => {
  it('reads text and tool_use blocks', () => {
    const r = parseAnthropicResponse({
      content: [
        { type: 'text', text: 'Let me check.' },
        { type: 'tool_use', id: 'toolu_01', name: 'get_cash', input: { account: 'Cash in Hand' } },
      ],
      stop_reason: 'tool_use',
    });
    expect(r.content).toBe('Let me check.');
    expect(r.toolCalls).toEqual([{ id: 'toolu_01', name: 'get_cash', args: { account: 'Cash in Hand' } }]);
    expect(r.stopReason).toBe('tool_use');
  });
  it('maps error envelopes to coded errors', () => {
    expect(() => parseAnthropicResponse({ type: 'error', error: { type: 'authentication_error', message: 'bad key' } })).toThrow(/badkey/);
    expect(() => parseAnthropicResponse({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } })).toThrow(/quota/);
    expect(() => parseAnthropicResponse({ type: 'error', error: { type: 'overloaded_error', message: 'busy' } })).toThrow(/failed/);
  });
  it('returns null content for a tool-only reply', () => {
    const r = parseAnthropicResponse({ content: [{ type: 'tool_use', id: 't', name: 'x', input: {} }] });
    expect(r.content).toBeNull();
  });
});

describe('openai shape (gateway fallback)', () => {
  it('spots a gateway that lost the tool block', async () => {
    const { lostToolCall, parseOpenAiResponse, toOpenAiBody } = await import('./openai');
    expect(lostToolCall(parseAnthropicResponse({ content: [], stop_reason: 'tool_use' }))).toBe(true);
    expect(lostToolCall(parseAnthropicResponse({ content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn' }))).toBe(false);
    const body = toOpenAiBody([{ role: 'system', content: 'sys' }, { role: 'user', content: 'owed?' }], { model: 'claude-sonnet-4-6', maxTokens: 100, tools });
    expect(body.tools).toHaveLength(1);
    expect((body.messages as { role: string }[])[0].role).toBe('system');
    const r = parseOpenAiResponse({ choices: [{ message: { content: 'Checking.', tool_calls: [{ id: 'tooluse_1', function: { name: 'get_cash', arguments: '{}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 4 } });
    expect(r?.toolCalls).toEqual([{ id: 'tooluse_1', name: 'get_cash', args: {} }]);
    expect(r?.usage).toEqual({ inputTokens: 10, outputTokens: 4 });
  });
});
