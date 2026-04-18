import type { AgentMessage } from '@wsa/agent-contracts';
import {
  appendTelemetryEvent,
  assertBudgetAvailable,
  cacheHitRatioForUsage,
  collapseLeadingSystemMessagesForCache,
  getBudgetState,
  notifySoftLimit,
  readXaiBudgetConfigFromEnv,
  XaiBudgetExceededError,
  XAI_DEFAULT_SOFT_LIMIT_THRESHOLD_PCT,
  type XaiSoftLimitAlert,
  type XaiTelemetryEvent,
} from './telemetry.js';

describe('xai telemetry helpers', () => {
  it('collapses leading system messages into a stable cache prefix', () => {
    const messages: ReadonlyArray<AgentMessage> = [
      { role: 'system', content: 'Alpha ' },
      { role: 'system', content: ' Beta' },
      { role: 'user', content: 'Hello' },
    ];

    expect(collapseLeadingSystemMessagesForCache(messages)).toEqual([
      { role: 'system', content: 'Alpha\n\nBeta' },
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('leaves message order untouched when there is only one system message', () => {
    const messages: ReadonlyArray<AgentMessage> = [
      { role: 'system', content: 'Alpha' },
      { role: 'user', content: 'Hello' },
    ];

    expect(collapseLeadingSystemMessagesForCache(messages)).toEqual(messages);
  });

  it('calculates cache hit ratio from cached input tokens', () => {
    expect(
      cacheHitRatioForUsage({
        inputTokens: 200,
        outputTokens: 10,
        totalTokens: 210,
        cachedInputTokens: 160,
      }),
    ).toBe(0.8);
  });

  it('returns null cache hit ratio when cache details are absent', () => {
    expect(
      cacheHitRatioForUsage({
        inputTokens: 200,
        outputTokens: 10,
        totalTokens: 210,
      }),
    ).toBeNull();
  });

  it('reads budget config from env and defaults the soft threshold to 80%', () => {
    expect(
      readXaiBudgetConfigFromEnv({
        XAI_BUDGET_MONTHLY_CAP_USD_TICKS: '2500000',
      }),
    ).toEqual({
      monthlyCapUsdTicks: 2500000,
      softLimitThresholdPct: XAI_DEFAULT_SOFT_LIMIT_THRESHOLD_PCT,
    });
  });

  it('rejects invalid budget threshold env values', () => {
    expect(() =>
      readXaiBudgetConfigFromEnv({
        XAI_BUDGET_MONTHLY_CAP_USD_TICKS: '2500000',
        XAI_BUDGET_SOFT_LIMIT_THRESHOLD_PCT: '0',
      }),
    ).toThrow(/between 1 and 100/);
  });

  it('builds budget state from the meter', async () => {
    await expect(
      getBudgetState(
        {
          monthlyCapUsdTicks: 1000,
          softLimitThresholdPct: 80,
          meter: {
            getMonthToDateCostUsdTicks: (monthKey) => {
              expect(monthKey).toBe('2026-04');
              return 300;
            },
          },
        },
        new Date('2026-04-18T12:00:00Z'),
      ),
    ).resolves.toEqual({
      monthKey: '2026-04',
      monthToDateCostUsdTicks: 300,
      monthlyCapUsdTicks: 1000,
      softLimitThresholdPct: 80,
    });
  });

  it('throws when the monthly budget is already exhausted', () => {
    expect(() =>
      assertBudgetAvailable({
        monthKey: '2026-04',
        monthToDateCostUsdTicks: 1000,
        monthlyCapUsdTicks: 1000,
        softLimitThresholdPct: 80,
      }),
    ).toThrow(XaiBudgetExceededError);
  });

  it('appends telemetry events through the sink', async () => {
    const events: XaiTelemetryEvent[] = [];
    const event: XaiTelemetryEvent = {
      occurredAt: '2026-04-18T12:00:00.000Z',
      monthKey: '2026-04',
      provider: 'xai',
      model: 'grok-4-fast-reasoning',
      taskKind: 'analysis',
      outcome: 'success',
      status: 'completed',
      rawFinishReason: 'stop',
      usage: {
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        cachedInputTokens: 90,
        costInUsdTicks: 12345,
      },
      cacheHitRatio: 0.9,
    };

    await appendTelemetryEvent(
      {
        append: (next) => {
          events.push(next);
        },
      },
      event,
    );

    expect(events).toEqual([event]);
  });

  it('notifies once when the projected spend crosses the soft limit threshold', async () => {
    const alerts: XaiSoftLimitAlert[] = [];
    await notifySoftLimit(
      {
        monthlyCapUsdTicks: 1000,
        softLimitThresholdPct: 80,
        meter: { getMonthToDateCostUsdTicks: () => 0 },
        softLimitSink: {
          notify: (alert) => {
            alerts.push(alert);
          },
        },
      },
      {
        monthKey: '2026-04',
        monthToDateCostUsdTicks: 700,
        monthlyCapUsdTicks: 1000,
        softLimitThresholdPct: 80,
      },
      {
        occurredAt: '2026-04-18T12:00:00.000Z',
        monthKey: '2026-04',
        provider: 'xai',
        model: 'grok-4-fast-reasoning',
        taskKind: 'analysis',
        requestId: 'req_1',
        outcome: 'success',
        status: 'completed',
        rawFinishReason: 'stop',
        usage: {
          inputTokens: 100,
          outputTokens: 10,
          totalTokens: 110,
          costInUsdTicks: 150,
        },
        cacheHitRatio: null,
        projectedMonthCostUsdTicks: 850,
        budgetCapUsdTicks: 1000,
        softLimitThresholdPct: 80,
      },
    );

    expect(alerts).toEqual([
      {
        occurredAt: '2026-04-18T12:00:00.000Z',
        monthKey: '2026-04',
        provider: 'xai',
        model: 'grok-4-fast-reasoning',
        taskKind: 'analysis',
        requestId: 'req_1',
        monthToDateCostUsdTicks: 700,
        projectedMonthCostUsdTicks: 850,
        budgetCapUsdTicks: 1000,
        softLimitThresholdPct: 80,
      },
    ]);
  });
});
