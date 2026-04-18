export {
  ClaimExtractionOutputSchema,
  ClaimExtractionCandidateSchema,
} from './lib/extraction-schema.js';
export type {
  ClaimExtractionCandidate,
  ClaimExtractionOutput,
} from './lib/extraction-schema.js';
export {
  createEvidenceEngine,
  createXaiEvidenceEngine,
  extractClaimsWithProvider,
} from './lib/runtime.js';
export type {
  ExtractionAuditRecord,
  ExtractionInput,
  ExtractionResult,
  ExtractedClaimRecord,
  EvidenceEngine,
  EvidenceEngineConfig,
  XaiEvidenceEngineConfig,
} from './lib/runtime.js';
