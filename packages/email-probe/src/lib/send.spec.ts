import { ResendSendError, sendProbe } from './send.js';

interface FakeFetchCall {
  readonly url: string;
  readonly init?: RequestInit;
}

function createFakeFetch(response: Response): {
  fetchImpl: typeof fetch;
  calls: FakeFetchCall[];
} {
  const calls: FakeFetchCall[] = [];
  const fetchImpl = ((
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : 'href' in input
          ? input.href
          : input.url;
    calls.push({
      url,
      ...(init === undefined ? {} : { init }),
    });
    return Promise.resolve(response);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('sendProbe', () => {
  it('POSTs to Resend with the expected JSON shape and returns the message id', async () => {
    const { fetchImpl, calls } = createFakeFetch(
      jsonResponse({ id: 'res-id-1' }),
    );

    const result = await sendProbe({
      apiKey: 'k',
      from: 'probe@mail.witnesssouthafrica.org',
      to: 'hello@witnesssouthafrica.org',
      subject: 'wsa-probe-20260418-subject',
      text: 'wsa-probe-20260418-body',
      fetch: fetchImpl,
    });

    expect(result.id).toBe('res-id-1');
    expect(result.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe('https://api.resend.com/emails');
    expect(call?.init?.method).toBe('POST');

    const rawBody = (call?.init?.body ?? '') as string;
    const sentBody = JSON.parse(rawBody) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
    };
    expect(sentBody.from).toBe('probe@mail.witnesssouthafrica.org');
    expect(sentBody.to).toEqual(['hello@witnesssouthafrica.org']);
    expect(sentBody.subject).toBe('wsa-probe-20260418-subject');
  });

  it('throws ResendSendError with 422 and validation message on bad payload', async () => {
    const { fetchImpl } = createFakeFetch(
      jsonResponse(
        {
          statusCode: 422,
          name: 'validation_error',
          message: 'Invalid `from` field.',
        },
        422,
      ),
    );

    await expect(
      sendProbe({
        apiKey: 'k',
        from: 'not-an-email',
        to: 'hello@witnesssouthafrica.org',
        subject: 's',
        text: 't',
        fetch: fetchImpl,
      }),
    ).rejects.toThrow(ResendSendError);
  });

  it('throws ResendSendError with the underlying 401 message on auth failure', async () => {
    const { fetchImpl } = createFakeFetch(
      jsonResponse(
        { statusCode: 401, name: 'unauthorized', message: 'Invalid API key' },
        401,
      ),
    );

    try {
      await sendProbe({
        apiKey: 'wrong',
        from: 'probe@mail.witnesssouthafrica.org',
        to: 'hello@witnesssouthafrica.org',
        subject: 's',
        text: 't',
        fetch: fetchImpl,
      });
      throw new Error('expected sendProbe to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ResendSendError);
      expect((err as ResendSendError).statusCode).toBe(401);
      expect((err as ResendSendError).errorName).toBe('unauthorized');
    }
  });

  it('throws ResendSendError when Resend returns 2xx without an id', async () => {
    const { fetchImpl } = createFakeFetch(jsonResponse({ not_id: 'x' }));

    await expect(
      sendProbe({
        apiKey: 'k',
        from: 'probe@mail.witnesssouthafrica.org',
        to: 'hello@witnesssouthafrica.org',
        subject: 's',
        text: 't',
        fetch: fetchImpl,
      }),
    ).rejects.toThrow(/malformed_response|Resend returned 2xx/);
  });
});
