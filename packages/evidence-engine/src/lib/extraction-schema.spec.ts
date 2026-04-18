import { ClaimExtractionOutputSchema } from './extraction-schema.js';

describe('ClaimExtractionOutputSchema', () => {
  it('accepts a candidate payload at the configured maxClaims boundary', () => {
    const schema = ClaimExtractionOutputSchema({ maxClaims: 2 });

    const result = schema.safeParse({
      summary: 'Two extracted claims.',
      claims: [
        {
          text: 'The clerk refused to release the requested record.',
          status: 'contested',
          supports: 'supports',
          rationale: 'The source text directly describes a refusal.',
        },
        {
          text: 'The family requested the record on 14 April 2026.',
          status: 'high-confidence',
          supports: 'supports',
          rationale: 'The date appears verbatim in the source text.',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a claim list longer than maxClaims', () => {
    const schema = ClaimExtractionOutputSchema({ maxClaims: 1 });

    const result = schema.safeParse({
      summary: 'Too many claims.',
      claims: [
        {
          text: 'The clerk refused to release the requested record.',
          status: 'contested',
          supports: 'supports',
          rationale: 'The source text directly describes a refusal.',
        },
        {
          text: 'The family requested the record on 14 April 2026.',
          status: 'high-confidence',
          supports: 'supports',
          rationale: 'The date appears verbatim in the source text.',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects malformed supports values', () => {
    const schema = ClaimExtractionOutputSchema({ maxClaims: 1 });

    const result = schema.safeParse({
      summary: 'Malformed support value.',
      claims: [
        {
          text: 'The clerk refused to release the requested record.',
          status: 'contested',
          supports: 'unknown',
          rationale: 'The source text directly describes a refusal.',
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
