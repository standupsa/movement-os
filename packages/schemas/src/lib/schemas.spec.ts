import {
  IntakeSchema,
  ClaimSchema,
  EvidenceSchema,
  ArtefactSchema,
  ApprovalSchema,
  AuditEventSchema,
  type Intake,
} from './schemas.js';

// Deterministic fixtures — ULIDs are syntactically valid (Crockford Base32)
// but not real. The alphabet excludes I, L, O, U.
const ULID = (tag: string): string => {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const cleaned = tag
    .toUpperCase()
    .split('')
    .map((c) => (alphabet.includes(c) ? c : '0'))
    .join('');
  return ('0'.repeat(26 - cleaned.length) + cleaned).slice(-26);
};

const validIntake: Intake = IntakeSchema.parse({
  id: ULID('INTAKE1'),
  receivedAt: '2026-04-18T08:00:00+02:00',
  channel: 'web-form',
  source: { kind: 'witness', label: 'Gauteng — SAPS delay, case 123/04/2026' },
  body: 'Case reference opened at SAPS station; no follow-up in 12 weeks.',
  sensitivity: 'redact-on-intake',
  lawfulBasis: 'public-interest',
  receivedBy: 'op.rudi',
});

describe('@sasa/schemas', () => {
  describe('IntakeSchema', () => {
    it('accepts a well-formed intake', () => {
      expect(validIntake.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(validIntake.lawfulBasis).toBe('public-interest');
    });

    it('rejects a body longer than 20 000 chars', () => {
      const result = IntakeSchema.safeParse({
        ...validIntake,
        body: 'x'.repeat(20_001),
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown channel', () => {
      const result = IntakeSchema.safeParse({ ...validIntake, channel: 'carrier-pigeon' });
      expect(result.success).toBe(false);
    });
  });

  describe('ClaimSchema', () => {
    it('requires a 10+ char text and a known status', () => {
      const ok = ClaimSchema.safeParse({
        id: ULID('CLAIM1'),
        intakeId: validIntake.id,
        text: 'SAPS took >12 weeks to act on case 123/04/2026.',
        extractedAt: '2026-04-18T09:00:00+02:00',
        extractedBy: 'agent:evidence-intake',
        status: 'unverified',
      });
      expect(ok.success).toBe(true);

      const bad = ClaimSchema.safeParse({
        id: ULID('CLAIM2'),
        intakeId: validIntake.id,
        text: 'short',
        extractedAt: '2026-04-18T09:00:00+02:00',
        extractedBy: 'agent:evidence-intake',
        status: 'unverified',
      });
      expect(bad.success).toBe(false);
    });
  });

  describe('EvidenceSchema', () => {
    it('requires a URL and a 64-char hex sha256', () => {
      const ok = EvidenceSchema.safeParse({
        id: ULID('EVID1'),
        claimId: ULID('CLAIM1'),
        kind: 'court-record',
        url: 'https://www.saflii.org/za/cases/ZACC/2025/1.html',
        fetchedAt: '2026-04-18T10:00:00+02:00',
        sha256: 'a'.repeat(64),
        supports: 'supports',
      });
      expect(ok.success).toBe(true);

      const bad = EvidenceSchema.safeParse({
        id: ULID('EVID2'),
        claimId: ULID('CLAIM1'),
        kind: 'court-record',
        url: 'not-a-url',
        fetchedAt: '2026-04-18T10:00:00+02:00',
        sha256: 'a'.repeat(64),
        supports: 'supports',
      });
      expect(bad.success).toBe(false);
    });
  });

  describe('ArtefactSchema + ApprovalSchema', () => {
    it('an artefact requires a principlesHash; approval requires the literal attestation', () => {
      const artefactId = ULID('ART1');
      const artefact = ArtefactSchema.safeParse({
        id: artefactId,
        kind: 'post',
        text: 'Draft post citing claim X.',
        createdAt: '2026-04-18T11:00:00+02:00',
        createdBy: 'agent:media-drafter',
        citedClaims: [ULID('CLAIM1')],
        principlesHash: 'b'.repeat(64),
      });
      expect(artefact.success).toBe(true);

      const badApproval = ApprovalSchema.safeParse({
        id: ULID('APPR1'),
        artefactId,
        approvedBy: 'op.rudi',
        approvedAt: '2026-04-18T11:05:00+02:00',
        attestation: 'lgtm',
      });
      expect(badApproval.success).toBe(false);

      const okApproval = ApprovalSchema.safeParse({
        id: ULID('APPR2'),
        artefactId,
        approvedBy: 'op.rudi',
        approvedAt: '2026-04-18T11:05:00+02:00',
        attestation:
          'I have read this artefact in full and approve its publication under my name.',
      });
      expect(okApproval.success).toBe(true);
    });
  });

  describe('AuditEventSchema', () => {
    it('enforces a known action and a hex prevHash', () => {
      const ok = AuditEventSchema.safeParse({
        id: ULID('AUD1'),
        at: '2026-04-18T12:00:00+02:00',
        actor: 'op.rudi',
        action: 'artefact.approved',
        detail: { artefactId: ULID('ART1') },
        prevHash: '0'.repeat(64),
      });
      expect(ok.success).toBe(true);

      const bad = AuditEventSchema.safeParse({
        id: ULID('AUD2'),
        at: '2026-04-18T12:00:00+02:00',
        actor: 'op.rudi',
        action: 'artefact.hexed', // unknown action
        detail: {},
        prevHash: '0'.repeat(64),
      });
      expect(bad.success).toBe(false);
    });
  });
});
