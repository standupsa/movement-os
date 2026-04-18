# Intake form — field version

Used on first contact with a family, witness, or complainant.
Mirrors `@sasa/schemas.IntakeSchema` so the field record maps
cleanly into the platform. The field worker completes this with the
source, in plain language, at the source's pace.

## A. Operator context

- Case reference (if any, assigned by platform): `__________`
- Field worker name: `__________`
- Field worker role (archive runner / witness documenter / records
  officer / case custodian): `__________`
- Date (YYYY-MM-DD): `__________`
- Time (24h, SAST): `__________`
- Location (suburb / town / province; street-level only if source
  volunteers it): `__________`

## B. Identity of the person giving information

Complete **only** if the person has given informed consent to record
their identity. If they have not, skip Section B and record only the
claim, unattributed, in Section D. Section B contents are Lane 1
sensitive intake under ADR-0003.

- Full name: `__________`
- Preferred contact channel (phone, e-mail, in-person only, or
  via intermediary): `__________`
- Relationship to the subject of the case: `__________`
- Minor (under 18)? `yes / no` — if yes, **stop** and follow the
  minors protocol (guardian consent required before continuing).

## C. Lawful basis for processing

Tick exactly one. POPIA requires this and `IntakeSchema` rejects
intakes without it.

- [ ] `consent` — the person has given informed consent, recorded
      per the consent script.
- [ ] `public-interest` — the processing is necessary to pursue a
      legitimate public-interest purpose; minimisation applies.
- [ ] `legal-obligation` — the processing is necessary for a legal
      obligation the operator has under South African law.

## D. The claim, in the source's own words

Record what the person is telling you as closely as possible to how
they said it. Do not clean it up. Do not translate yet — if the
source spoke Afrikaans, isiZulu, isiXhosa, Sesotho, or any other
language, record it in that language first; platform translation is
performed later with native-speaker review.

- Subject of the case (name, if known; role; context): `__________`
- When did this happen (date or best-estimate window): `__________`
- Where did this happen (town, suburb, facility, if known):
  `__________`
- What happened (narrative — use as much space as is needed, do not
  truncate): `__________`
- Who else saw or heard what happened: `__________`
- What records might exist (dockets, medical, employment, military,
  municipal, school, church, newspaper): `__________`

## E. Safety assessment

- Is the source currently at risk of harm, retaliation, or
  intimidation because of speaking to you? `yes / no / unsure`
- Has the source been contacted by anyone warning them not to
  speak? `yes / no`
- Does the source want their identity kept off any public record
  until further notice? `yes / no`
- NPA witness-protection triage indicated? `yes / no` — if yes,
  attach separate triage note.

If any answer is `yes`, Section B must be marked `never-persist`
in the platform intake and the case custodian must be notified
the same day.

## F. Consents and permissions

- Consent to record (audio / video / written): `yes / no`
  — which: `__________`
- Consent to share with a second field worker for corroboration:
  `yes / no`
- Consent for the platform to pursue records on the source's
  behalf (PAIA, subject-access): `yes / no`
- Consent for eventual publication of any part of the account,
  subject to final review at that time: `yes / no`
- Signature (or mark) of the source: `__________`
- Witness to signature: `__________`

## G. Next steps agreed with the source

- What will happen next (the field worker names specific follow-up
  steps and dates): `__________`
- How and when the field worker will check back in: `__________`
- How the source can withdraw consent at any time and what that
  will mean in practice: `__________`

## H. Upload into the platform

After the meeting:

1. Convert this record into an `Intake` using `@sasa/schemas`.
2. Set `lawfulBasis` per Section C.
3. Mark Section B contents `never-persist` if Section E triggers
   protection.
4. Record an `AuditEvent` of type `intake.created` with the field
   worker's identity.
5. Route the case to the case custodian for triage and next-step
   scheduling.

Nothing in this form is published by default. Publication requires a
separate `Approval`.
