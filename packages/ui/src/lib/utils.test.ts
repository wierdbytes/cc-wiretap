import { describe, expect, it } from 'vitest';
import { extractModelName } from './utils';

describe('extractModelName', () => {
  describe('new format: claude-{tier}-{major}-{minor}[-date]', () => {
    it('parses opus-4-6', () => {
      expect(extractModelName('claude-opus-4-6')).toBe('Opus 4.6');
    });

    it('parses opus with date suffix', () => {
      expect(extractModelName('claude-opus-4-5-20250929')).toBe('Opus 4.5');
    });

    it('parses sonnet with date suffix', () => {
      expect(extractModelName('claude-sonnet-4-5-20250929')).toBe('Sonnet 4.5');
    });

    it('parses haiku with date suffix', () => {
      expect(extractModelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5');
    });

    it('parses major-only version', () => {
      expect(extractModelName('claude-sonnet-4-20250514')).toBe('Sonnet 4');
    });

    it('suppresses .0 minor version', () => {
      expect(extractModelName('claude-opus-5-0')).toBe('Opus 5');
    });
  });

  describe('old format: claude-{major}[-{minor}]-{tier}[-date]', () => {
    it('parses 3-5-sonnet with date', () => {
      expect(extractModelName('claude-3-5-sonnet-20241022')).toBe('Sonnet 3.5');
    });

    it('parses 3-opus with date', () => {
      expect(extractModelName('claude-3-opus-20240229')).toBe('Opus 3');
    });

    it('parses 3-haiku with date', () => {
      expect(extractModelName('claude-3-haiku-20240307')).toBe('Haiku 3');
    });

    it('parses 3-5-haiku with date', () => {
      expect(extractModelName('claude-3-5-haiku-20241022')).toBe('Haiku 3.5');
    });
  });

  describe('future-proofing', () => {
    it('handles hypothetical opus-5-3', () => {
      expect(extractModelName('claude-opus-5-3')).toBe('Opus 5.3');
    });

    it('handles hypothetical sonnet-6 with date', () => {
      expect(extractModelName('claude-sonnet-6-20270101')).toBe('Sonnet 6');
    });

    it('handles hypothetical haiku-7-2 with date', () => {
      expect(extractModelName('claude-haiku-7-2-20280501')).toBe('Haiku 7.2');
    });
  });

  describe('tier only (no version)', () => {
    it('returns capitalized tier for bare tier name', () => {
      expect(extractModelName('opus')).toBe('Opus');
      expect(extractModelName('sonnet')).toBe('Sonnet');
      expect(extractModelName('haiku')).toBe('Haiku');
    });
  });

  describe('unknown models', () => {
    it('returns first two segments for multi-part IDs', () => {
      expect(extractModelName('gpt-4-turbo')).toBe('gpt-4');
    });

    it('returns raw string for single-part IDs', () => {
      expect(extractModelName('gemini')).toBe('gemini');
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase input', () => {
      expect(extractModelName('Claude-Opus-4-6')).toBe('Opus 4.6');
    });

    it('handles mixed case input', () => {
      expect(extractModelName('CLAUDE-SONNET-4-5-20250929')).toBe('Sonnet 4.5');
    });
  });
});
