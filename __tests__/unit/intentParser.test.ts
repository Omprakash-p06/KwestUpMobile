/**
 * Unit Test Suite: On-Device AI Intent Parser & Rule RAG
 *
 * Requirements Covered: [AI-03]
 * Codebase Alignment: ARCHITECTURE.md, CONCERNS.md, TESTING.md
 */

import { parseUserIntent } from '../../src/ai/intentParser';
import { parseIntentHeuristic, normalizeTimeString } from '../../src/ai/heuristicParser';
import { retrieveRulePacket, formatRulePacketForPrompt, MAX_PROMPT_RULE_PACKET_LENGTH } from '../../src/ai/rulePacketRetriever';
import * as aiService from '../../src/utils/aiService';

describe('intentParser', () => {
  describe('Rule Packet Retriever (retrieveRulePacket & formatRulePacketForPrompt)', () => {
    it('matches behavioral keywords to corresponding machine rules', () => {
      const stackingPacket = retrieveRulePacket('I want to do pushups right after morning coffee');
      expect(stackingPacket.ruleIds).toContain('CUE_STACK_001');
      expect(stackingPacket.ruleIds).toContain('CUE_STACK_002');

      const identityPacket = retrieveRulePacket('I want to become an active athlete');
      expect(identityPacket.ruleIds).toContain('HABIT_IDENTITY_ANCHOR_001');

      const recoveryPacket = retrieveRulePacket('I missed my meditation habit yesterday');
      expect(recoveryPacket.ruleIds).toContain('NEVER_MISS_TWICE_001');

      const pausePacket = retrieveRulePacket('Pause my daily reading while I travel on vacation');
      expect(pausePacket.ruleIds).toContain('HABIT_PAUSE_001');

      const minActionPacket = retrieveRulePacket('Start small with a quick 2 min routine');
      expect(minActionPacket.ruleIds).toContain('MINIMUM_ACTION_001');
    });

    it('enforces maximum rule count of 3', () => {
      // Input contains triggers for stack, identity, 2-min, recovery, and pause
      const multiTrigger = 'after dinner become an athlete with quick 2 min routine when I missed and pause';
      const packet = retrieveRulePacket(multiTrigger);
      expect(packet.ruleIds.length).toBeLessThanOrEqual(3);
    });

    it('clamps formatted prompt text to MAX_PROMPT_RULE_PACKET_LENGTH (200 chars)', () => {
      const longPacket = {
        ruleIds: ['RULE_1', 'RULE_2', 'RULE_3'],
        snippets: [
          'A'.repeat(80),
          'B'.repeat(80),
          'C'.repeat(80),
        ],
        formattedPromptText: '',
      };

      const formatted = formatRulePacketForPrompt(longPacket);
      expect(formatted.length).toBeLessThanOrEqual(MAX_PROMPT_RULE_PACKET_LENGTH);
      expect(formatted).toMatch(/\.\.\.\]$/);
    });

    it('handles empty or non-string inputs safely', () => {
      const emptyPacket = retrieveRulePacket('');
      expect(emptyPacket.ruleIds).toEqual([]);
      expect(emptyPacket.formattedPromptText).toBe('');

      const nullPacket = retrieveRulePacket(null as any);
      expect(nullPacket.ruleIds).toEqual([]);
    });
  });

  describe('Offline Heuristic Parser (parseIntentHeuristic)', () => {
    it('normalizes time strings into 24-hour HH:mm format', () => {
      expect(normalizeTimeString('7:30am')).toBe('07:30');
      expect(normalizeTimeString('7:30 am')).toBe('07:30');
      expect(normalizeTimeString('8pm')).toBe('20:00');
      expect(normalizeTimeString('12pm')).toBe('12:00');
      expect(normalizeTimeString('12am')).toBe('00:00');
      expect(normalizeTimeString('14:45')).toBe('14:45');
      expect(normalizeTimeString('invalid')).toBeUndefined();
      expect(normalizeTimeString('25:00')).toBeUndefined();
    });

    it('extracts habit creation with habit stacking anchor and evening time', () => {
      const input = 'I want to study DSA every evening after dinner';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('study dsa');
      expect(intent.cueType).toBe('after-habit');
      expect(intent.anchor).toBe('dinner');
      expect(intent.time).toBe('20:00');
      expect(intent.frequency).toBe('daily');
      expect(intent.source).toBe('heuristic');
      expect(intent.confidence).toBeGreaterThan(0.8);
    });

    it('extracts habit creation with explicit clock time and weekday frequency', () => {
      const input = 'Run at 7:30 AM every weekday';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('run');
      expect(intent.time).toBe('07:30');
      expect(intent.frequency).toBe('weekdays');
      expect(intent.cueType).toBe('time');
    });

    it('extracts custom weekday schedule', () => {
      const input = 'Workout on Mondays and Wednesdays in the gym';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.frequency).toBe('custom');
      expect(intent.customWeekdays).toEqual([1, 3]); // Mon=1, Wed=3
      expect(intent.location).toBe('gym');
    });

    it('extracts deletion action', () => {
      const input = 'Delete my late-night snacking habit';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('DELETE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('late-night snacking');
    });

    it('extracts pause action and reason', () => {
      const input = 'Pause guitar practice for summer vacation';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('PAUSE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('guitar practice');
      expect(intent.reason).toBe('summer vacation');
    });

    it('extracts adjust difficulty action', () => {
      const input = 'Pushups are too hard, make it easier';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('ADJUST_DIFFICULTY');
    });

    it('extracts log habit completion action', () => {
      const input = 'I completed my morning meditation today';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('LOG_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('morning meditation');
    });

    it('extracts start recovery action', () => {
      const input = 'I missed reading yesterday, need to start recovery';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('START_RECOVERY');
    });
  });

  describe('Specialist Intent Parser Pipeline (parseUserIntent)', () => {
    let mockLlamaContext: any;

    beforeEach(() => {
      mockLlamaContext = {
        completion: jest.fn(),
      };
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('handles short or empty inputs safely', async () => {
      const res = await parseUserIntent('hi');
      expect(res.behavior).toBe('');
      expect(res.confidence).toBe(0);
    });

    it('parses user intent using on-device LLM output when available', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'loadModel').mockResolvedValue(mockLlamaContext);

      // Simulate LLM streaming valid JSON
      mockLlamaContext.completion.mockImplementation(async (_options: any, callback: any) => {
        const jsonResponse = JSON.stringify({
          action: 'CREATE_HABIT',
          behavior: 'Drink 500ml water',
          frequency: 'daily',
          cueType: 'morning',
          time: '08:00',
          minimumAction: 'Drink 1 sip',
        });
        callback({ token: jsonResponse });
      });

      const intent = await parseUserIntent('Remind me to drink 500ml water every morning');

      expect(intent.source).toBe('llm');
      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.behavior).toBe('Drink 500ml water');
      expect(intent.time).toBe('08:00');
      expect(intent.minimumAction).toBe('Drink 1 sip');
      expect(intent.confidence).toBe(0.95);
      expect(intent.rulesRetrieved).toBeDefined();
    });

    it('gracefully falls back to heuristic parser when LLM outputs malformed JSON', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'loadModel').mockResolvedValue(mockLlamaContext);

      // Simulate LLM outputting broken non-JSON text
      mockLlamaContext.completion.mockImplementation(async (_options: any, callback: any) => {
        callback({ token: 'Sure! I can help you with that habit. You should read books.' });
      });

      const intent = await parseUserIntent('I want to read books every evening after dinner');

      expect(intent.source).toBe('heuristic');
      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('read books');
      expect(intent.anchor).toBe('dinner');
      expect(intent.cueType).toBe('after-habit');
    });

    it('gracefully falls back to heuristic parser when native LLM throws', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'loadModel').mockRejectedValue(new Error('GGML out of memory'));

      const intent = await parseUserIntent('Delete my smoking habit');

      expect(intent.source).toBe('heuristic');
      expect(intent.action).toBe('DELETE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('smoking');
    });

    it('bypasses LLM when forceHeuristic is true', async () => {
      const loadModelSpy = jest.spyOn(aiService, 'loadModel');

      const intent = await parseUserIntent('Pause guitar practice for vacation', { forceHeuristic: true });

      expect(loadModelSpy).not.toHaveBeenCalled();
      expect(intent.source).toBe('heuristic');
      expect(intent.action).toBe('PAUSE_HABIT');
    });

    it('uses heuristic parser when model is not downloaded on device', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(false);
      const loadModelSpy = jest.spyOn(aiService, 'loadModel');

      const intent = await parseUserIntent('Run at 7:00 AM daily');

      expect(loadModelSpy).not.toHaveBeenCalled();
      expect(intent.source).toBe('heuristic');
      expect(intent.time).toBe('07:00');
      expect(intent.frequency).toBe('daily');
    });

    it('gracefully falls back to heuristic parser when inference times out', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'loadModel').mockResolvedValue(mockLlamaContext);

      // Simulate a stalled LLM completion that does not resolve in time
      mockLlamaContext.completion.mockImplementation(() => new Promise(() => {}));

      const intent = await parseUserIntent('Meditate at 8:00 AM daily', { timeoutMs: 50 });

      expect(intent.source).toBe('heuristic');
      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('meditate');
      expect(intent.time).toBe('08:00');
    });
  });

  describe('Heuristic Edge Cases & Defenses', () => {
    it('safely escapes regex metacharacters in habit stack anchor without crashing', () => {
      const input = 'Do stretching after workout (heavy leg day)?';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('stretching');
      expect(intent.anchor).toBe('workout (heavy leg day)?');
      expect(intent.cueType).toBe('after-habit');
    });

    it('adjusts AM/PM-less hour to evening 24h format when utterance mentions evening', () => {
      const input = 'Study at 7 in the evening every day';
      const intent = parseIntentHeuristic(input);

      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.time).toBe('19:00');
      expect(intent.cueType).toBe('time');
    });
  });
});
