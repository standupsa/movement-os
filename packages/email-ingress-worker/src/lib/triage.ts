import { parseAuthenticationVerdicts, type MailAuthVerdict } from './auth.js';

export type MailSpamVerdict = 'clean' | 'suspect' | 'fail';
export type MailAuthSummaryVerdict = 'pass' | 'suspect' | 'fail' | 'unknown';

export interface MailTriage {
  readonly spamVerdict: MailSpamVerdict;
  readonly authVerdict: MailAuthSummaryVerdict;
  readonly spfVerdict: MailAuthVerdict;
  readonly dkimVerdict: MailAuthVerdict;
  readonly dmarcVerdict: MailAuthVerdict;
  readonly headerAnomalies: readonly string[];
  readonly messageSizeBytes: number;
}

const SUSPICIOUS_SUBJECT_PATTERN =
  /\b(urgent|winner|won|prize|bitcoin|investment|loan|casino|viagra|free money)\b/i;

function deriveAuthVerdict(
  spfVerdict: MailAuthVerdict,
  dkimVerdict: MailAuthVerdict,
  dmarcVerdict: MailAuthVerdict,
): MailAuthSummaryVerdict {
  if (dmarcVerdict === 'pass') {
    return 'pass';
  }

  if (
    dmarcVerdict === 'fail' ||
    dmarcVerdict === 'permerror' ||
    dmarcVerdict === 'temperror' ||
    (spfVerdict === 'fail' && dkimVerdict === 'fail')
  ) {
    return 'fail';
  }

  if (
    spfVerdict === 'unknown' &&
    dkimVerdict === 'unknown' &&
    dmarcVerdict === 'unknown'
  ) {
    return 'unknown';
  }

  return 'suspect';
}

function collectHeaderAnomalies(
  headers: Headers,
  messageSizeBytes: number,
): string[] {
  const anomalies: string[] = [];
  const subject = headers.get('subject') ?? '';
  const messageId = headers.get('message-id');
  const date = headers.get('date');
  const precedence = headers.get('precedence');
  const spamFlag = headers.get('x-spam-flag');
  const authResults = headers.get('authentication-results');

  if (!authResults) {
    anomalies.push('missing-authentication-results');
  }

  if (!messageId) {
    anomalies.push('missing-message-id');
  }

  if (!date) {
    anomalies.push('missing-date');
  }

  if (precedence && /^(bulk|junk|list)$/i.test(precedence.trim())) {
    anomalies.push(`precedence-${precedence.trim().toLowerCase()}`);
  }

  if (spamFlag && /^yes$/i.test(spamFlag.trim())) {
    anomalies.push('x-spam-flag');
  }

  if (messageSizeBytes > 5 * 1024 * 1024) {
    anomalies.push('oversized-message');
  }

  if (
    subject.length > 0 &&
    subject.toUpperCase() === subject &&
    SUSPICIOUS_SUBJECT_PATTERN.test(subject)
  ) {
    anomalies.push('suspicious-subject');
  }

  return anomalies;
}

export function triageMessage(
  headers: Headers,
  messageSizeBytes: number,
): MailTriage {
  const auth = parseAuthenticationVerdicts(headers);
  const headerAnomalies = collectHeaderAnomalies(headers, messageSizeBytes);
  const authVerdict = deriveAuthVerdict(auth.spf, auth.dkim, auth.dmarc);

  let spamVerdict: MailSpamVerdict = 'clean';

  if (authVerdict === 'fail') {
    spamVerdict = 'fail';
  } else if (authVerdict !== 'pass' || headerAnomalies.length > 0) {
    spamVerdict = 'suspect';
  }

  return {
    spamVerdict,
    authVerdict,
    spfVerdict: auth.spf,
    dkimVerdict: auth.dkim,
    dmarcVerdict: auth.dmarc,
    headerAnomalies,
    messageSizeBytes,
  };
}
