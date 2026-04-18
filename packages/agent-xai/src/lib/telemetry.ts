import type {
  AgentMessage,
  AgentTaskKind,
  TokenUsage,
} from '@wsa/agent-contracts';

export const XAI_DEFAULT_SOFT_LIMIT_THRESHOLD_PCT = 80;

export interface XaiTelemetryEvent {
  readonly occurredAt: string;
  readonly monthKey: string;
  readonly provider: 'xai';
  readonly model: string;
  readonly taskKind: AgentTaskKind;
  readonly requestId?: string;
  readonly responseId?: string;
  readonly outcome: 'success' | 'error' | 'budget-blocked';
  readonly status?: 'completed' | 'in_progress' | 'incomplete';
  readonly rawFinishReason?: string;
  readonly usage: TokenUsage;
  readonly cacheHitRatio: number | null;
  readonly monthToDateCostUsdTicks?: number;
  readonly projectedMonthCostUsdTicks?: number;
  readonly budgetCapUsdTicks?: number;
  readonly softLimitThresholdPct?: number;
  readonly errorMessage?: string;
}

export interface XaiTelemetrySink {
  append(event: XaiTelemetryEvent): Promise<void> | void;
}

export interface XaiBudgetConfig {
  readonly monthlyCapUsdTicks: number;
  readonly softLimitThresholdPct: number;
}

export interface XaiBudgetMeter {
  getMonthToDateCostUsdTicks(monthKey: string): Promise<number> | number;
}

export interface XaiSoftLimitAlert {
  readonly occurredAt: string;
  readonly monthKey: string;
  readonly provider: 'xai';
  readonly model: string;
  readonly taskKind: AgentTaskKind;
  readonly requestId?: string;
  readonly monthToDateCostUsdTicks: number;
  readonly projectedMonthCostUsdTicks: number;
  readonly budgetCapUsdTicks: number;
  readonly softLimitThresholdPct: number;
}

export interface XaiSoftLimitSink {
  notify(alert: XaiSoftLimitAlert): Promise<void> | void;
}

export interface XaiBudgetPolicy extends XaiBudgetConfig {
  readonly meter: XaiBudgetMeter;
  readonly softLimitSink?: XaiSoftLimitSink;
}

export interface XaiTelemetryOptions {
  readonly sink?: XaiTelemetrySink;
  readonly budget?: XaiBudgetPolicy;
  readonly clock?: () => Date;
}

export interface XaiBudgetState {
  readonly monthKey: string;
  readonly monthToDateCostUsdTicks: number;
  readonly monthlyCapUsdTicks: number;
  readonly softLimitThresholdPct: number;
}

export class XaiBudgetExceededError extends Error {
  readonly monthKey: string;
  readonly monthToDateCostUsdTicks: number;
  readonly monthlyCapUsdTicks: number;

  constructor(params: {
    readonly monthKey: string;
    readonly monthToDateCostUsdTicks: number;
    readonly monthlyCapUsdTicks: number;
  }) {
    super(
      `xai adapter: monthly budget exhausted for ${params.monthKey} (${String(params.monthToDateCostUsdTicks)}/${String(params.monthlyCapUsdTicks)} usd ticks)`,
    );
    this.name = 'XaiBudgetExceededError';
    this.monthKey = params.monthKey;
    this.monthToDateCostUsdTicks = params.monthToDateCostUsdTicks;
    this.monthlyCapUsdTicks = params.monthlyCapUsdTicks;
  }
}

export function collapseLeadingSystemMessagesForCache(
  messages: ReadonlyArray<AgentMessage>,
): ReadonlyArray<AgentMessage> {
  let leadingSystemCount = 0;
  for (const message of messages) {
    if (message.role !== 'system') {
      break;
    }
    leadingSystemCount += 1;
  }

  if (leadingSystemCount <= 1) {
    return messages;
  }

  const systemPrefix = messages
    .slice(0, leadingSystemCount)
    .map((message) => message.content.trim())
    .join('\n\n');

  return [
    { role: 'system', content: systemPrefix },
    ...messages.slice(leadingSystemCount),
  ];
}

export function cacheHitRatioForUsage(usage: TokenUsage): number | null {
  if (usage.inputTokens === 0 || usage.cachedInputTokens === undefined) {
    return null;
  }
  return usage.cachedInputTokens / usage.inputTokens;
}

export async function getBudgetState(
  budget: XaiBudgetPolicy | undefined,
  now: Date,
): Promise<XaiBudgetState | null> {
  if (budget === undefined) {
    return null;
  }

  const monthKey = toMonthKey(now);
  const monthToDateCostUsdTicks =
    await budget.meter.getMonthToDateCostUsdTicks(monthKey);
  return {
    monthKey,
    monthToDateCostUsdTicks,
    monthlyCapUsdTicks: budget.monthlyCapUsdTicks,
    softLimitThresholdPct: budget.softLimitThresholdPct,
  };
}

export function assertBudgetAvailable(state: XaiBudgetState | null): void {
  if (state === null) {
    return;
  }
  if (state.monthToDateCostUsdTicks >= state.monthlyCapUsdTicks) {
    throw new XaiBudgetExceededError({
      monthKey: state.monthKey,
      monthToDateCostUsdTicks: state.monthToDateCostUsdTicks,
      monthlyCapUsdTicks: state.monthlyCapUsdTicks,
    });
  }
}

export async function appendTelemetryEvent(
  sink: XaiTelemetrySink | undefined,
  event: XaiTelemetryEvent,
): Promise<void> {
  if (sink === undefined) {
    return;
  }
  await sink.append(event);
}

export async function notifySoftLimit(
  budget: XaiBudgetPolicy | undefined,
  state: XaiBudgetState | null,
  event: XaiTelemetryEvent,
): Promise<void> {
  if (
    budget?.softLimitSink === undefined ||
    state === null ||
    event.projectedMonthCostUsdTicks === undefined
  ) {
    return;
  }

  const thresholdTicks = Math.floor(
    (state.monthlyCapUsdTicks * state.softLimitThresholdPct) / 100,
  );
  const previouslyBelow = state.monthToDateCostUsdTicks < thresholdTicks;
  const nowAtOrAbove = event.projectedMonthCostUsdTicks >= thresholdTicks;

  if (!previouslyBelow || !nowAtOrAbove) {
    return;
  }

  await budget.softLimitSink.notify({
    occurredAt: event.occurredAt,
    monthKey: state.monthKey,
    provider: 'xai',
    model: event.model,
    taskKind: event.taskKind,
    monthToDateCostUsdTicks: state.monthToDateCostUsdTicks,
    projectedMonthCostUsdTicks: event.projectedMonthCostUsdTicks,
    budgetCapUsdTicks: state.monthlyCapUsdTicks,
    softLimitThresholdPct: state.softLimitThresholdPct,
    ...(event.requestId !== undefined ? { requestId: event.requestId } : {}),
  });
}

export function readXaiBudgetConfigFromEnv(
  env: Record<string, string | undefined>,
): XaiBudgetConfig | null {
  const monthlyCapUsdTicks = parseOptionalInt(
    env.XAI_BUDGET_MONTHLY_CAP_USD_TICKS,
  );
  if (monthlyCapUsdTicks === undefined) {
    return null;
  }

  const softLimitThresholdPct =
    parseOptionalInt(env.XAI_BUDGET_SOFT_LIMIT_THRESHOLD_PCT) ??
    XAI_DEFAULT_SOFT_LIMIT_THRESHOLD_PCT;

  if (softLimitThresholdPct < 1 || softLimitThresholdPct > 100) {
    throw new Error(
      'xai adapter: XAI_BUDGET_SOFT_LIMIT_THRESHOLD_PCT must be an integer between 1 and 100',
    );
  }

  return {
    monthlyCapUsdTicks,
    softLimitThresholdPct,
  };
}

function parseOptionalInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      'xai adapter: budget env values must be non-negative integers',
    );
  }
  return Number.parseInt(raw, 10);
}

function toMonthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}
