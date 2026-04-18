import { ArtefactSchema } from './artefact.js';
import { ulid } from './test-fixtures.js';

const valid = {
  id: ulid('ART1'),
  kind: 'post' as const,
  text: 'Draft post citing claim X.',
  createdAt: '2026-04-18T11:00:00+02:00',
  createdBy: 'agent:media-drafter' as const,
  citedClaims: [ulid('CLAIM1')],
  principlesHash: 'b'.repeat(64),
};

describe('ArtefactSchema', () => {
  it('accepts a well-formed artefact', () => {
    const result = ArtefactSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects a missing principlesHash', () => {
    const { principlesHash: _omit, ...rest } = valid;
    void _omit;
    const result = ArtefactSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    const result = ArtefactSchema.safeParse({ ...valid, rogue: 1 });
    expect(result.success).toBe(false);
  });
});
