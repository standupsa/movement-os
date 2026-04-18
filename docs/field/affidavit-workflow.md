# Affidavit workflow

Turning a statement into a sworn affidavit before a Commissioner
of Oaths, consistent with the Justices of the Peace and
Commissioners of Oaths Act 16 of 1963 (South Africa) and its
regulations. An affidavit turns a witness account into a document
that can be used in PAIA requests, inquest re-opening applications,
reviews, complaints to the South African Human Rights Commission,
and NPA referrals.

Field workers do **not** act as Commissioners of Oaths. Each
deployment identifies a list of trusted Commissioners (police
officers of rank, certain lawyers, justices of the peace, and
others gazetted from time to time) and makes them available to
the source.

## When an affidavit is appropriate

- The source wants their account to carry legal weight.
- A PAIA request is about to be escalated to the Information
  Regulator.
- An inquest re-opening application is being prepared.
- A complaint is being lodged with a statutory body.
- The platform is about to publish a finding that rests on a
  specific person's testimony and that person has given
  publication consent.

An affidavit is **not** required for general intake. Most intakes
are recorded testimony, not sworn statements. Do not pressure any
source into deposing; deposing is voluntary.

## The workflow

### Step 1 — Draft

The case custodian prepares a draft affidavit using the source's own
words from the interview recording and notes. Structure:

- Deponent's full name, identity number (if given), age, occupation,
  address (may be care-of the operator).
- The statement: "I, the undersigned, do hereby make oath / solemnly
  affirm and state that the facts deposed to herein are, to the best
  of my knowledge, true and correct."
- Numbered paragraphs of fact, in the source's voice, in the
  language the source used.
- Paragraphs separating first-hand observation from hearsay; mark
  hearsay as hearsay.
- Annexures if relevant (referenced as "Annexure A" etc.), each
  annexure page-numbered and signed.

### Step 2 — Review

- The source reviews the draft in full, in their language.
- Corrections are made on the draft. The source initials each
  correction.
- The source's consent to deposing is re-confirmed.

### Step 3 — Swear

- The source attends before a Commissioner of Oaths.
- The Commissioner asks the deponent whether they know and
  understand the contents, whether they have any objection to
  taking the prescribed oath, and whether the prescribed oath or
  affirmation will be binding on their conscience.
- The deponent signs in the Commissioner's presence.
- The Commissioner signs, prints their name, writes their capacity
  (e.g. "Police Officer, SAPS Benoni"), address, and date. They
  apply the official stamp where they carry one.

### Step 4 — Chain of custody

- The field worker photographs or scans the signed original in
  the Commissioner's presence (if consented).
- A `ChainOfCustodyEntry` is created:
  - `artifactKind: affidavit`
  - `sha256` of the scan
  - Custodian: the field worker's platform identity
  - Transfer log: source → field worker → case custodian →
    platform archive
- The signed original is lodged with the operator's records officer.

### Step 5 — Platform

- An `Evidence` record is created in `@wsa/schemas` referencing
  the affidavit artefact and the case.
- An `AuditEvent` of type `evidence.added` is appended to the
  hash-chained log.
- The evidential-completeness status of the relevant `Claim` is
  re-evaluated, applying the ADR-0002 vocabulary.

## Minors and vulnerable deponents

- A minor (under 18) deposes only with a guardian's written consent
  and in the guardian's presence.
- If a deponent appears to be impaired or under duress, the
  Commissioner and the field worker **stop**. The affidavit is not
  executed that day.

## Withdrawal

If a deponent later withdraws:

- The affidavit remains on the record (it was a sworn statement at
  a point in time) but is flagged as withdrawn.
- Any publication drafted on its basis is re-routed through the
  publication `Approval` gate and must be re-assessed on the
  remaining evidence.
- The audit log records the withdrawal.

## Not legal advice

This workflow is an operational checklist, not legal advice.
Complex cases — especially those involving inquest re-opening,
review of a prosecutorial decision, or civil claims against organs
of state — should be run past an attorney before deposing.
