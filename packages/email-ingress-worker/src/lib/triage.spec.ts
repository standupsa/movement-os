import { triageMessage } from './triage.js';

describe('triageMessage', () => {
  it('classifies fully authenticated mail as clean', () => {
    const headers = new Headers({
      'authentication-results':
        'mx.cloudflare.net; spf=pass smtp.mailfrom=example.org; dkim=pass header.d=example.org; dmarc=pass header.from=example.org',
      'message-id': '<m1@example.org>',
      date: 'Sat, 18 Apr 2026 15:00:00 +0000',
      subject: 'Meeting notes',
    });

    expect(triageMessage(headers, 512)).toStrictEqual({
      spamVerdict: 'clean',
      authVerdict: 'pass',
      spfVerdict: 'pass',
      dkimVerdict: 'pass',
      dmarcVerdict: 'pass',
      headerAnomalies: [],
      messageSizeBytes: 512,
    });
  });

  it('marks failed DMARC mail as fail', () => {
    const headers = new Headers({
      'authentication-results':
        'mx.cloudflare.net; spf=pass; dkim=fail header.d=evil.example; dmarc=fail header.from=example.org',
      'message-id': '<m1@example.org>',
      date: 'Sat, 18 Apr 2026 15:00:00 +0000',
    });

    expect(triageMessage(headers, 1024)).toMatchObject({
      spamVerdict: 'fail',
      authVerdict: 'fail',
      dmarcVerdict: 'fail',
    });
  });

  it('marks messages with missing auth headers as suspect', () => {
    const headers = new Headers({
      subject: 'Normal note',
      'message-id': '<m1@example.org>',
      date: 'Sat, 18 Apr 2026 15:00:00 +0000',
    });

    expect(triageMessage(headers, 256)).toMatchObject({
      spamVerdict: 'suspect',
      authVerdict: 'unknown',
      headerAnomalies: ['missing-authentication-results'],
    });
  });

  it('marks suspicious all-caps subject mail as suspect', () => {
    const headers = new Headers({
      'authentication-results':
        'mx.cloudflare.net; spf=pass; dkim=pass header.d=example.org; dmarc=pass header.from=example.org',
      subject: 'URGENT BITCOIN WINNER',
      'message-id': '<m1@example.org>',
      date: 'Sat, 18 Apr 2026 15:00:00 +0000',
    });

    expect(triageMessage(headers, 256)).toMatchObject({
      spamVerdict: 'suspect',
      authVerdict: 'pass',
      headerAnomalies: ['suspicious-subject'],
    });
  });

  it('marks bulk or spam-flagged mail as suspect without dropping evidence', () => {
    const headers = new Headers({
      'authentication-results':
        'mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass',
      precedence: 'bulk',
      'x-spam-flag': 'YES',
      'message-id': '<m1@example.org>',
      date: 'Sat, 18 Apr 2026 15:00:00 +0000',
    });

    expect(triageMessage(headers, 256)).toMatchObject({
      spamVerdict: 'suspect',
      headerAnomalies: ['precedence-bulk', 'x-spam-flag'],
    });
  });
});
