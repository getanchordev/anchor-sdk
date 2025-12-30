/**
 * Tests for framework integrations.
 */

/// <reference types="jest" />

import { Anchor } from '../anchor';
import { AnchorMemory, AnchorChatHistory } from '../integrations/langchain';
import { AnchorCrewAgent, AnchorCrewMemory } from '../integrations/crewai';
import { AnchorMem0 } from '../integrations/mem0';

// Mock fetch globally
global.fetch = jest.fn();

// Disable telemetry in tests
process.env.ANCHOR_TELEMETRY = '0';

describe('LangChain Integration', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  let anchor: Anchor;

  beforeEach(() => {
    mockFetch.mockClear();
    anchor = new Anchor({ apiKey: 'anc_test_key' });
  });

  describe('AnchorMemory', () => {
    it('should initialize with default options', () => {
      const memory = new AnchorMemory(anchor, 'agent_123');

      expect(memory.memoryVariables).toEqual(['chat_history']);
    });

    it('should initialize with custom options', () => {
      const memory = new AnchorMemory(anchor, 'agent_123', {
        memoryKey: 'history',
        returnMessages: false,
        sessionId: 'custom_session',
      });

      expect(memory.memoryVariables).toEqual(['history']);
    });

    it('should save context to Anchor', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'chat:session:human:123',
            allowed: true,
            audit_id: 'audit_1',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'chat:session:ai:124',
            allowed: true,
            audit_id: 'audit_2',
          }),
        } as Response);

      const memory = new AnchorMemory(anchor, 'agent_123', { sessionId: 'test_session' });
      await memory.saveContext(
        { input: 'Hello' },
        { output: 'Hi there!' }
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should load memory variables', async () => {
      // Keys are sorted alphabetically, so 'ai' comes before 'human'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            keys: [
              { key: 'chat:test:human:100' },
              { key: 'chat:test:ai:101' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'chat:test:ai:101',
            value: 'Hi there!',
            metadata: { role: 'ai' },
            audit_id: 'audit_1',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'chat:test:human:100',
            value: 'Hello',
            metadata: { role: 'human' },
            audit_id: 'audit_2',
          }),
        } as Response);

      const memory = new AnchorMemory(anchor, 'agent_123', { sessionId: 'test' });
      const result = await memory.loadMemoryVariables({});

      expect(result).toHaveProperty('chat_history');
      expect(result.chat_history).toHaveLength(2);
      // Sorted alphabetically: 'ai' before 'human'
      expect(result.chat_history[0].role).toBe('ai');
      expect(result.chat_history[0].content).toBe('Hi there!');
      expect(result.chat_history[1].role).toBe('human');
      expect(result.chat_history[1].content).toBe('Hello');
    });

    it('should return formatted string when returnMessages is false', async () => {
      // Keys are sorted alphabetically, so 'ai' comes before 'human'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            keys: [
              { key: 'chat:test:human:100' },
              { key: 'chat:test:ai:101' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'chat:test:ai:101',
            value: 'Hi',
            audit_id: 'audit_1',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'chat:test:human:100',
            value: 'Hello',
            audit_id: 'audit_2',
          }),
        } as Response);

      const memory = new AnchorMemory(anchor, 'agent_123', {
        sessionId: 'test',
        returnMessages: false,
      });
      const result = await memory.loadMemoryVariables({});

      expect(typeof result.chat_history).toBe('string');
      // Contains both messages (order depends on alphabetical sort)
      expect(result.chat_history).toContain('Human: Hello');
      expect(result.chat_history).toContain('AI: Hi');
    });

    it('should clear memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ deleted_count: 5 }),
      } as Response);

      const memory = new AnchorMemory(anchor, 'agent_123', { sessionId: 'test' });
      await memory.clear();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/agent_123/data?prefix=chat%3Atest%3A'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should create checkpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'cp_123',
          agent_id: 'agent_123',
          label: 'test-checkpoint',
          config_version: 'v1',
          data_snapshot: {},
        }),
      } as Response);

      const memory = new AnchorMemory(anchor, 'agent_123');
      const checkpointId = await memory.createCheckpoint('test-checkpoint');

      expect(checkpointId).toBe('cp_123');
    });

    it('should restore checkpoint', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            restored_from: 'cp_123',
            config_restored: true,
            data_restored: true,
            data_keys_restored: 10,
            data_keys_removed: 5,
            audit_id: 'audit_restore',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ keys: [] }),
        } as Response);

      const memory = new AnchorMemory(anchor, 'agent_123', { sessionId: 'test' });
      await memory.restoreCheckpoint('cp_123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/agent_123/checkpoints/cp_123/restore'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('AnchorChatHistory', () => {
    it('should initialize correctly', () => {
      const history = new AnchorChatHistory(anchor, 'agent_123');

      expect(history).toBeDefined();
    });

    it('should add human message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          key: 'chat:test:human:123',
          allowed: true,
          audit_id: 'audit_1',
        }),
      } as Response);

      const history = new AnchorChatHistory(anchor, 'agent_123', { sessionId: 'test' });
      await history.addUserMessage('Hello');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/agent_123/data'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello'),
        })
      );
    });

    it('should add AI message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          key: 'chat:test:ai:123',
          allowed: true,
          audit_id: 'audit_1',
        }),
      } as Response);

      const history = new AnchorChatHistory(anchor, 'agent_123', { sessionId: 'test' });
      await history.addAIMessage('Hi there!');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should get messages', async () => {
      // Keys are sorted alphabetically, so 'ai' comes before 'human'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            keys: [
              { key: 'chat:test:human:100' },
              { key: 'chat:test:ai:101' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'chat:test:ai:101',
            value: 'Hi',
            audit_id: 'audit_1',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'chat:test:human:100',
            value: 'Hello',
            audit_id: 'audit_2',
          }),
        } as Response);

      const history = new AnchorChatHistory(anchor, 'agent_123', { sessionId: 'test' });
      const messages = await history.getMessages();

      expect(messages).toHaveLength(2);
      // Sorted alphabetically: 'ai' before 'human'
      expect(messages[0].role).toBe('ai');
      expect(messages[1].role).toBe('human');
    });

    it('should clear messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ deleted_count: 10 }),
      } as Response);

      const history = new AnchorChatHistory(anchor, 'agent_123', { sessionId: 'test' });
      await history.clear();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/agent_123/data?prefix=chat%3Atest%3A'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});

describe('CrewAI Integration', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  let anchor: Anchor;

  beforeEach(() => {
    mockFetch.mockClear();
    anchor = new Anchor({ apiKey: 'anc_test_key' });
  });

  describe('AnchorCrewAgent', () => {
    it('should initialize with options', () => {
      const agent = new AnchorCrewAgent(anchor, {
        role: 'Researcher',
        goal: 'Research topics',
        backstory: 'Expert researcher',
      });

      expect(agent.role).toBe('Researcher');
      expect(agent.goal).toBe('Research topics');
      expect(agent.backstory).toBe('Expert researcher');
    });

    it('should initialize and create agent in Anchor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          agent: {
            id: 'agent_crew_123',
            name: 'crew-researcher',
            status: 'active',
          },
        }),
      } as Response);

      const agent = new AnchorCrewAgent(anchor, {
        role: 'Researcher',
        goal: 'Research topics',
      });
      await agent.initialize();

      expect(agent.agentId).toBe('agent_crew_123');
    });

    it('should use provided agentId without creating new', async () => {
      const agent = new AnchorCrewAgent(anchor, {
        role: 'Researcher',
        goal: 'Research topics',
        agentId: 'existing_agent',
      });

      expect(agent.agentId).toBe('existing_agent');
    });

    it('should store data with policy enforcement', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-researcher', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'findings',
            allowed: true,
            audit_id: 'audit_1',
          }),
        } as Response);

      const agent = new AnchorCrewAgent(anchor, {
        role: 'Researcher',
        goal: 'Research topics',
      });
      const stored = await agent.store('findings', 'Research results');

      expect(stored).toBe(true);
    });

    it('should return false when blocked by policy', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-researcher', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'email',
            allowed: false,
            audit_id: 'audit_1',
            blocked_by: 'pii_filter',
          }),
        } as Response);

      const agent = new AnchorCrewAgent(anchor, {
        role: 'Researcher',
        goal: 'Research topics',
      });
      const stored = await agent.store('email', 'user@example.com');

      expect(stored).toBe(false);
    });

    it('should retrieve data', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-researcher', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ value: 'Research results' }),
        } as Response);

      const agent = new AnchorCrewAgent(anchor, {
        role: 'Researcher',
        goal: 'Research topics',
      });
      const value = await agent.retrieve('findings');

      expect(value).toBe('Research results');
    });

    it('should search data', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-researcher', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            results: [
              { key: 'finding1', value: 'Result 1', similarity: 0.95 },
              { key: 'finding2', value: 'Result 2', similarity: 0.85 },
            ],
          }),
        } as Response);

      const agent = new AnchorCrewAgent(anchor, {
        role: 'Researcher',
        goal: 'Research topics',
      });
      const results = await agent.search('research findings', 5);

      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('finding1');
      expect(results[0].similarity).toBe(0.95);
    });
  });

  describe('AnchorCrewMemory', () => {
    it('should initialize correctly', () => {
      const memory = new AnchorCrewMemory(anchor);
      expect(memory).toBeDefined();
    });

    it('should use provided agentId', () => {
      const memory = new AnchorCrewMemory(anchor, { agentId: 'existing_agent' });
      expect(memory.agentId).toBe('existing_agent');
    });

    it('should create agent on initialize', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          agent: { id: 'agent_memory_123', name: 'crew-shared-memory', status: 'active' },
        }),
      } as Response);

      const memory = new AnchorCrewMemory(anchor);
      await memory.initialize();

      expect(memory.agentId).toBe('agent_memory_123');
    });

    it('should save data', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-shared-memory', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'shared_key',
            allowed: true,
            audit_id: 'audit_1',
          }),
        } as Response);

      const memory = new AnchorCrewMemory(anchor);
      const saved = await memory.save('shared_key', 'shared_value');

      expect(saved).toBe(true);
    });

    it('should save objects as JSON', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-shared-memory', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            key: 'object_key',
            allowed: true,
            audit_id: 'audit_1',
          }),
        } as Response);

      const memory = new AnchorCrewMemory(anchor);
      await memory.save('object_key', { nested: 'value' });

      // The second call (not first) is the data write
      const calls = mockFetch.mock.calls;
      const dataWriteCall = calls[1];
      // The object is JSON.stringify'd, then that string is put in the body (also JSON)
      // So we expect escaped JSON in the body
      expect(dataWriteCall?.[1]?.body).toContain('\\"nested\\":\\"value\\"');
    });

    it('should search memory', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-shared-memory', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            results: [
              { key: 'result1', value: 'data1', similarity: 0.9 },
            ],
          }),
        } as Response);

      const memory = new AnchorCrewMemory(anchor);
      const results = await memory.search('query');

      expect(results).toHaveLength(1);
    });

    it('should get data by key', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-shared-memory', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ value: 'stored_value' }),
        } as Response);

      const memory = new AnchorCrewMemory(anchor);
      const value = await memory.get('key');

      expect(value).toBe('stored_value');
    });

    it('should delete data by key', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-shared-memory', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ deleted: true }),
        } as Response);

      const memory = new AnchorCrewMemory(anchor);
      const deleted = await memory.delete('key');

      expect(deleted).toBe(true);
    });

    it('should clear all memory', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-shared-memory', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ deleted_count: 10 }),
        } as Response);

      const memory = new AnchorCrewMemory(anchor);
      const count = await memory.clear();

      expect(count).toBe(10);
    });

    it('should create checkpoint', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-shared-memory', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            id: 'cp_crew_123',
            agent_id: 'agent_123',
            config_version: 'v1',
            data_snapshot: {},
          }),
        } as Response);

      const memory = new AnchorCrewMemory(anchor);
      const checkpointId = await memory.createCheckpoint('test');

      expect(checkpointId).toBe('cp_crew_123');
    });

    it('should restore checkpoint', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            agent: { id: 'agent_123', name: 'crew-shared-memory', status: 'active' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            restored_from: 'cp_123',
            config_restored: true,
            data_restored: true,
            data_keys_restored: 5,
            data_keys_removed: 0,
            audit_id: 'audit_restore',
          }),
        } as Response);

      const memory = new AnchorCrewMemory(anchor);
      await memory.restoreCheckpoint('cp_123');

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/checkpoints/cp_123/restore'),
        expect.any(Object)
      );
    });
  });
});

describe('Mem0 Integration', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  let anchor: Anchor;
  let mockMem0: any;

  beforeEach(() => {
    mockFetch.mockClear();
    anchor = new Anchor({ apiKey: 'anc_test_key' });
    mockMem0 = {
      add: jest.fn().mockResolvedValue({ id: 'mem_123' }),
      search: jest.fn().mockResolvedValue([{ id: 'mem_123', content: 'test' }]),
      get: jest.fn().mockResolvedValue({ id: 'mem_123', content: 'test' }),
      getAll: jest.fn().mockResolvedValue([{ id: 'mem_123' }]),
      update: jest.fn().mockResolvedValue({ id: 'mem_123' }),
      delete: jest.fn().mockResolvedValue(true),
      deleteAll: jest.fn().mockResolvedValue(true),
      history: jest.fn().mockResolvedValue([]),
      reset: jest.fn().mockResolvedValue(true),
    };
  });

  describe('AnchorMem0', () => {
    it('should initialize correctly', () => {
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);

      expect(wrapped.agentId).toBe('agent_123');
    });

    it('should add memory when allowed by policy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          key: 'mem0:add:123',
          allowed: true,
          audit_id: 'audit_1',
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.add('User prefers dark mode', { userId: 'user_123' });

      expect(result.allowed).toBe(true);
      expect(result.mem0Result).toEqual({ id: 'mem_123' });
      expect(mockMem0.add).toHaveBeenCalledWith('User prefers dark mode', { userId: 'user_123' });
    });

    it('should block add when policy fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          key: 'mem0:add:123',
          allowed: false,
          audit_id: 'audit_1',
          blocked_by: 'pii_filter',
          reason: 'Email detected',
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.add('user@example.com', { userId: 'user_123' });

      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe('pii_filter');
      expect(result.reason).toBe('Email detected');
      expect(result.mem0Result).toBeUndefined();
      expect(mockMem0.add).not.toHaveBeenCalled();
    });

    it('should search with audit logging', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          key: 'mem0:search:123',
          allowed: true,
          audit_id: 'audit_1',
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const results = await wrapped.search('dark mode', { userId: 'user_123', limit: 5 });

      expect(results).toHaveLength(1);
      expect(mockMem0.search).toHaveBeenCalledWith('dark mode', { userId: 'user_123', limit: 5 });
    });

    it('should get memory by ID', async () => {
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.get('mem_123');

      expect(result).toEqual({ id: 'mem_123', content: 'test' });
      expect(mockMem0.get).toHaveBeenCalledWith('mem_123');
    });

    it('should get all memories', async () => {
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const results = await wrapped.getAll({ userId: 'user_123' });

      expect(results).toHaveLength(1);
      expect(mockMem0.getAll).toHaveBeenCalledWith({ userId: 'user_123' });
    });

    it('should update memory when allowed by policy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          key: 'mem0:update:mem_123:123',
          allowed: true,
          audit_id: 'audit_1',
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.update('mem_123', 'Updated content');

      expect(result.allowed).toBe(true);
      expect(mockMem0.update).toHaveBeenCalledWith('mem_123', 'Updated content', undefined);
    });

    it('should block update when policy fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          key: 'mem0:update:mem_123:123',
          allowed: false,
          audit_id: 'audit_1',
          blocked_by: 'pii_filter',
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.update('mem_123', 'user@example.com');

      expect(result.allowed).toBe(false);
      expect(mockMem0.update).not.toHaveBeenCalled();
    });

    it('should delete memory', async () => {
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.delete('mem_123');

      expect(result).toBe(true);
      expect(mockMem0.delete).toHaveBeenCalledWith('mem_123');
    });

    it('should delete all memories', async () => {
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.deleteAll({ userId: 'user_123' });

      expect(result).toBe(true);
      expect(mockMem0.deleteAll).toHaveBeenCalledWith({ userId: 'user_123' });
    });

    it('should throw if deleteAll not supported', async () => {
      delete mockMem0.deleteAll;
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);

      await expect(wrapped.deleteAll()).rejects.toThrow('deleteAll not supported');
    });

    it('should get memory history', async () => {
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const history = await wrapped.history('mem_123');

      expect(history).toEqual([]);
      expect(mockMem0.history).toHaveBeenCalledWith('mem_123', undefined);
    });

    it('should throw if history not supported', async () => {
      delete mockMem0.history;
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);

      await expect(wrapped.history('mem_123')).rejects.toThrow('history not supported');
    });

    it('should reset memories', async () => {
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.reset();

      expect(result).toBe(true);
      expect(mockMem0.reset).toHaveBeenCalled();
    });

    it('should throw if reset not supported', async () => {
      delete mockMem0.reset;
      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);

      await expect(wrapped.reset()).rejects.toThrow('reset not supported');
    });

    it('should create checkpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'cp_mem0_123',
          agent_id: 'agent_123',
          config_version: 'v1',
          data_snapshot: {},
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const checkpointId = await wrapped.createCheckpoint('test');

      expect(checkpointId).toBe('cp_mem0_123');
    });

    it('should restore checkpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          restored_from: 'cp_123',
          config_restored: true,
          data_restored: true,
          data_keys_restored: 10,
          data_keys_removed: 0,
          audit_id: 'audit_restore',
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      await wrapped.restoreCheckpoint('cp_123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/checkpoints/cp_123/restore'),
        expect.any(Object)
      );
    });

    it('should query audit log', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          events: [
            { id: 'audit_1', operation: 'data.write', result: 'allowed' },
          ],
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const events = await wrapped.queryAuditLog({ limit: 10 });

      expect(events).toHaveLength(1);
    });

    it('should verify audit chain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          valid: true,
          events_checked: 100,
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const verification = await wrapped.verifyAuditChain();

      expect(verification.valid).toBe(true);
    });

    it('should export audit log', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          export_id: 'exp_123',
          format: 'json',
          download_url: 'https://example.com/export',
          event_count: 100,
        }),
      } as Response);

      const wrapped = new AnchorMem0(anchor, 'agent_123', mockMem0);
      const result = await wrapped.exportAuditLog({ format: 'json' });

      expect(result.exportId).toBe('exp_123');
    });
  });
});

describe('Integration Module Exports', () => {
  it('should export LangChain integration', async () => {
    const { AnchorMemory, AnchorChatHistory } = await import('../integrations/langchain');
    expect(AnchorMemory).toBeDefined();
    expect(AnchorChatHistory).toBeDefined();
  });

  it('should export CrewAI integration', async () => {
    const { AnchorCrewAgent, AnchorCrewMemory } = await import('../integrations/crewai');
    expect(AnchorCrewAgent).toBeDefined();
    expect(AnchorCrewMemory).toBeDefined();
  });

  it('should export Mem0 integration', async () => {
    const { AnchorMem0 } = await import('../integrations/mem0');
    expect(AnchorMem0).toBeDefined();
  });

  it('should export from index', async () => {
    const integrations = await import('../integrations');
    expect(integrations.AnchorMemory).toBeDefined();
    expect(integrations.AnchorChatHistory).toBeDefined();
    expect(integrations.AnchorCrewAgent).toBeDefined();
    expect(integrations.AnchorCrewMemory).toBeDefined();
    expect(integrations.AnchorMem0).toBeDefined();
  });
});
