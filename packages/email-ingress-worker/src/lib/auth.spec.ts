import { parseAuthenticationVerdicts } from './auth.js';

describe('parseAuthenticationVerdicts', () => {
  it('extracts SPF, DKIM, and DMARC verdicts from Authentication-Results', () => {
    const headers = new Headers({
      'authentication-results':
        'mx.cloudflare.net; spf=pass smtp.mailfrom=example.org; dkim=pass header.d=example.org; dmarc=pass header.from=example.org',
    });

    expect(parseAuthenticationVerdicts(headers)).toStrictEqual({
      spf: 'pass',
      dkim: 'pass',
      dmarc: 'pass',
    });
  });

  it('falls back to Received-SPF when Authentication-Results omits SPF', () => {
    const headers = new Headers({
      'authentication-results': 'mx.cloudflare.net; dkim=pass; dmarc=pass',
      'received-spf': 'pass (sender SPF authorized)',
    });

    expect(parseAuthenticationVerdicts(headers)).toStrictEqual({
      spf: 'pass',
      dkim: 'pass',
      dmarc: 'pass',
    });
  });

  it('returns unknown verdicts when auth headers are absent', () => {
    expect(parseAuthenticationVerdicts(new Headers())).toStrictEqual({
      spf: 'unknown',
      dkim: 'unknown',
      dmarc: 'unknown',
    });
  });
});
