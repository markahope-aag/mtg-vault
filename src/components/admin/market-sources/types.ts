export type Source = {
  id: string;
  sourceKey: string;
  displayName: string;
  baseUrl: string;
  parserTemplate: string;
  enabled: boolean;
  robotsAcknowledged: boolean;
  termsNotes: string | null;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  useWebUnlocker: boolean;
  lastRunAt: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

export type Template = {
  key: string;
  displayName: string;
  description: string;
};
