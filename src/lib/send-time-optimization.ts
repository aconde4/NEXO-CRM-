import { timeToMinutes, type SendWindow } from "@/lib/send-window";

export const SEND_TIME_SIGNAL_TYPES = ["open", "click", "reply"] as const;

export type SendTimeSignalType = (typeof SEND_TIME_SIGNAL_TYPES)[number];

export type SendTimeSignal = {
  occurredAt: Date;
  type: SendTimeSignalType;
};

export type SendTimeAdviceSource = "contact" | "default" | "global";
export type SendTimeConfidence = "high" | "low" | "medium" | "none";

export type SendTimeBucket = {
  clicks: number;
  hour: number;
  label: string;
  opens: number;
  replies: number;
  score: number;
  signals: number;
};

export type SendTimeAdvice = {
  buckets: SendTimeBucket[];
  confidence: SendTimeConfidence;
  evidence: {
    clicks: number;
    opens: number;
    replies: number;
  };
  label: string;
  recommendedHour: number;
  score: number;
  signalCount: number;
  source: SendTimeAdviceSource;
  timeZone: string;
};

export type SendTimeAdviceInput = {
  fallbackHour?: number;
  now?: Date;
  signals: SendTimeSignal[];
  source: SendTimeAdviceSource;
  timeZone: string;
};

const SIGNAL_WEIGHT: Record<SendTimeSignalType, number> = {
  click: 3,
  open: 1,
  reply: 5,
};

function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(23, Math.max(0, Math.trunc(value)));
}

export function sendTimeLabel(hour: number, minute = 0): string {
  return `${String(clampHour(hour)).padStart(2, "0")}:${String(
    Math.min(59, Math.max(0, Math.trunc(minute))),
  ).padStart(2, "0")}`;
}

function eventHour(date: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
  return clampHour(Number(formatted));
}

function recencyMultiplier(date: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
  if (ageDays <= 30) return 1.4;
  if (ageDays <= 90) return 1.15;
  return 1;
}

function confidenceFor(input: {
  score: number;
  signalCount: number;
  replies: number;
}): SendTimeConfidence {
  if (input.signalCount === 0) return "none";
  if (input.score >= 9 || (input.replies > 0 && input.signalCount >= 3)) {
    return "high";
  }
  if (input.score >= 4 || input.signalCount >= 2) return "medium";
  return "low";
}

export function buildSendTimeAdvice({
  fallbackHour = 10,
  now = new Date(),
  signals,
  source,
  timeZone,
}: SendTimeAdviceInput): SendTimeAdvice {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    clicks: 0,
    hour,
    label: sendTimeLabel(hour),
    opens: 0,
    replies: 0,
    score: 0,
    signals: 0,
  }));

  for (const signal of signals) {
    const hour = eventHour(signal.occurredAt, timeZone);
    const bucket = buckets[hour]!;
    bucket.signals += 1;
    bucket.score +=
      SIGNAL_WEIGHT[signal.type] * recencyMultiplier(signal.occurredAt, now);
    if (signal.type === "open") bucket.opens += 1;
    if (signal.type === "click") bucket.clicks += 1;
    if (signal.type === "reply") bucket.replies += 1;
  }

  const best =
    buckets
      .filter((bucket) => bucket.signals > 0)
      .sort((a, b) => b.score - a.score || b.replies - a.replies)[0] ?? null;
  const recommendedHour = best?.hour ?? clampHour(fallbackHour);
  const evidence = buckets.reduce(
    (acc, bucket) => ({
      clicks: acc.clicks + bucket.clicks,
      opens: acc.opens + bucket.opens,
      replies: acc.replies + bucket.replies,
    }),
    { clicks: 0, opens: 0, replies: 0 },
  );
  const signalCount = signals.length;
  const score = best?.score ?? 0;

  return {
    buckets,
    confidence: confidenceFor({
      replies: evidence.replies,
      score,
      signalCount,
    }),
    evidence,
    label: sendTimeLabel(recommendedHour),
    recommendedHour,
    score,
    signalCount,
    source,
    timeZone,
  };
}

function minuteIsInsideWindow(current: number, start: number, end: number) {
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function effectiveSendTimeForWindow(
  recommendedHour: number,
  window: SendWindow,
): { hour: number; minute: number } {
  const target = clampHour(recommendedHour) * 60;
  const start = timeToMinutes(window.windowStart);
  const end = timeToMinutes(window.windowEnd);
  if (minuteIsInsideWindow(target, start, end)) {
    return { hour: Math.floor(target / 60), minute: target % 60 };
  }
  return { hour: Math.floor(start / 60), minute: start % 60 };
}

export function shouldApplySendTimeAdvice(advice: SendTimeAdvice): boolean {
  return (
    advice.source !== "default" &&
    (advice.confidence === "medium" || advice.confidence === "high")
  );
}
