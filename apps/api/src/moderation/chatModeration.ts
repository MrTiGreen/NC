import type {
  ModerationActionDto,
  ModerationNoticeDto,
  ModerationSeverityDto
} from "@telegram-mini-chat/shared";

export type ModerationReason = "profanity" | "obscene" | "harassment" | "threat";

export type ModerationViolation = {
  reason: ModerationReason;
  severity: ModerationSeverityDto;
  matchedRuleIds: string[];
};

export type ModerationOutcome = {
  action: ModerationActionDto;
  severity: ModerationSeverityDto;
  reason: ModerationReason;
  mutedUntil: Date | null;
  jailedUntil: Date | null;
  muteDurationMinutes: number | null;
  jailDurationMinutes: number | null;
  notice: ModerationNoticeDto;
};

type ModerationSource = "raw" | "rawCompact" | "latinCompact" | "cyrillicCompact";

type ModerationPattern = {
  id: string;
  source: ModerationSource;
  regex: RegExp;
  reason: ModerationReason;
  severity: ModerationSeverityDto;
};

type NormalizedMessage = Record<ModerationSource, string>;

const severityRank: Record<ModerationSeverityDto, number> = {
  mild: 1,
  moderate: 2,
  severe: 3
};

const reasonLabel: Record<ModerationReason | "active_mute" | "active_jail", string> = {
  active_jail: "тюрьма за рецидивы в общем чате",
  active_mute: "действующий мут общего чата",
  profanity: "грубость или мат",
  obscene: "непристойное содержимое",
  harassment: "оскорбление",
  threat: "угрозы или травля"
};

const latinFoldMap: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
  а: "a",
  в: "b",
  е: "e",
  ё: "e",
  і: "i",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x"
};

const cyrillicFoldMap: Record<string, string> = {
  "0": "о",
  "3": "е",
  "4": "а",
  "6": "б",
  "@": "а",
  a: "а",
  b: "в",
  c: "с",
  d: "д",
  e: "е",
  g: "г",
  h: "н",
  i: "и",
  j: "й",
  k: "к",
  l: "л",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  u: "у",
  x: "х",
  y: "у"
};

const moderationPatterns: ModerationPattern[] = [
  {
    id: "en-threat",
    source: "raw",
    regex: /(?:^|[^\p{L}\p{N}])(?:kill\s+yourself|die\s+now)(?=$|[^\p{L}\p{N}])/u,
    reason: "threat",
    severity: "severe"
  },
  {
    id: "en-threat-short",
    source: "latinCompact",
    regex: /kys/u,
    reason: "threat",
    severity: "severe"
  },
  {
    id: "ru-threat",
    source: "raw",
    regex: /(?:^|[^\p{L}\p{N}])(?:убью|умри|сдохни|убейся)(?=$|[^\p{L}\p{N}])/u,
    reason: "threat",
    severity: "severe"
  },
  {
    id: "ja-threat",
    source: "rawCompact",
    regex: /(?:死ね|殺す|消えろ)/u,
    reason: "threat",
    severity: "severe"
  },
  {
    id: "en-obscene",
    source: "raw",
    regex: /(?:^|[^\p{L}\p{N}])(?:porn|porno|nude|nudes|sex)(?=$|[^\p{L}\p{N}])/u,
    reason: "obscene",
    severity: "moderate"
  },
  {
    id: "ru-obscene",
    source: "cyrillicCompact",
    regex: /(?:порно|секс|эротик|сиськ|член|вагин|анал|минет|сперм|конч|трах|дроч)/u,
    reason: "obscene",
    severity: "moderate"
  },
  {
    id: "ja-obscene",
    source: "rawCompact",
    regex: /(?:エロ|セックス|ポルノ)/u,
    reason: "obscene",
    severity: "moderate"
  },
  {
    id: "en-profanity-obfuscated",
    source: "latinCompact",
    regex: /(?:fuck|fucking|motherfucker|shithead|asshole|bitch|dickhead)/u,
    reason: "profanity",
    severity: "moderate"
  },
  {
    id: "en-profanity-word",
    source: "raw",
    regex: /(?:^|[^\p{L}\p{N}])(?:shit|cunt|dick|bastard)(?=$|[^\p{L}\p{N}])/u,
    reason: "profanity",
    severity: "moderate"
  },
  {
    id: "ru-profanity",
    source: "cyrillicCompact",
    regex: /(?:пизд|пздц|бляд|блят|еба|ёба|ебл|ебн|ебу|ебы|ёбу|ёбы|сука|сучар|гандон|залуп|мраз|пидор|педик)/u,
    reason: "profanity",
    severity: "moderate"
  },
  {
    id: "ru-profanity-word",
    source: "raw",
    regex: /(?:^|[^\p{L}\p{N}])(?:хуй|хуя|хуе|хуё|хуи)(?=$|[^\p{L}\p{N}])/u,
    reason: "profanity",
    severity: "moderate"
  },
  {
    id: "ja-profanity",
    source: "rawCompact",
    regex: /(?:くそ|クソ)/u,
    reason: "profanity",
    severity: "mild"
  },
  {
    id: "en-harassment",
    source: "raw",
    regex: /(?:^|[^\p{L}\p{N}])(?:idiot|moron|stupid|retard)(?=$|[^\p{L}\p{N}])/u,
    reason: "harassment",
    severity: "mild"
  },
  {
    id: "ru-harassment",
    source: "cyrillicCompact",
    regex: /(?:идиот|дебил|мудак|урод)/u,
    reason: "harassment",
    severity: "mild"
  },
  {
    id: "ja-harassment",
    source: "rawCompact",
    regex: /(?:ばか|バカ|あほ|アホ|きもい)/u,
    reason: "harassment",
    severity: "mild"
  }
];

export function inspectPublicMessage(text: string): ModerationViolation | null {
  const normalized = normalizeMessage(text);
  const matches = moderationPatterns.filter((pattern) => pattern.regex.test(normalized[pattern.source]));

  if (matches.length === 0) {
    return null;
  }

  const highest = matches.reduce((current, next) =>
    severityRank[next.severity] > severityRank[current.severity] ? next : current
  );
  const escalatedSeverity =
    highest.severity === "mild" && matches.length >= 2 ? "moderate" : highest.severity;

  return {
    reason: highest.reason,
    severity: escalatedSeverity,
    matchedRuleIds: matches.map((match) => match.id)
  };
}

export function resolveModerationOutcome(
  violation: ModerationViolation,
  recentViolationCount: number,
  now = new Date()
): ModerationOutcome {
  const jailDurationMinutes = getJailDurationMinutes(recentViolationCount);
  const jailedUntil = jailDurationMinutes
    ? new Date(now.getTime() + jailDurationMinutes * 60 * 1000)
    : null;
  const muteDurationMinutes = getMuteDurationMinutes(violation.severity, recentViolationCount);
  const action: ModerationActionDto = jailDurationMinutes
    ? "user_jailed"
    : muteDurationMinutes
      ? "user_muted"
      : "warn_message_muted";
  const mutedUntil = muteDurationMinutes
    ? new Date(now.getTime() + muteDurationMinutes * 60 * 1000)
    : null;
  const message = buildOutcomeMessage(violation.reason, action, muteDurationMinutes, jailDurationMinutes);

  return {
    action,
    severity: violation.severity,
    reason: violation.reason,
    mutedUntil,
    jailedUntil,
    muteDurationMinutes,
    jailDurationMinutes,
    notice: {
      action,
      severity: violation.severity,
      reason: violation.reason,
      message,
      mutedUntil: mutedUntil?.toISOString() ?? null,
      jailedUntil: jailedUntil?.toISOString() ?? null
    }
  };
}

export function buildActiveJailNotice(jailedUntil: Date): ModerationNoticeDto {
  return {
    action: "user_jailed",
    severity: "severe",
    reason: "active_jail",
    mutedUntil: null,
    jailedUntil: jailedUntil.toISOString(),
    message: `Игрок в тюрьме до ${jailedUntil.toLocaleString("ru-RU")} за рецидивы в общем чате. Личные сообщения этим ботом не мониторятся.`
  };
}

export function buildActiveMuteNotice(mutedUntil: Date): ModerationNoticeDto {
  return {
    action: "user_muted",
    severity: "moderate",
    reason: "active_mute",
    mutedUntil: mutedUntil.toISOString(),
    jailedUntil: null,
    message: `Общий чат временно недоступен до ${mutedUntil.toLocaleString("ru-RU")}. Личные сообщения этим ботом не мониторятся.`
  };
}

export function getMuteDurationMinutes(
  severity: ModerationSeverityDto,
  recentViolationCount: number
): number | null {
  if (getJailDurationMinutes(recentViolationCount)) {
    return null;
  }

  if (severity !== "severe" && recentViolationCount <= 0) {
    return null;
  }

  const durations: Record<ModerationSeverityDto, number[]> = {
    mild: [15, 30, 60, 240, 1440, 10080],
    moderate: [30, 60, 240, 1440, 10080],
    severe: [60, 240, 1440, 10080]
  };
  const index = severity === "severe" ? recentViolationCount : recentViolationCount - 1;

  return durations[severity][Math.min(Math.max(index, 0), durations[severity].length - 1)];
}

export function getJailDurationMinutes(recentViolationCount: number): number | null {
  if (recentViolationCount < 2) {
    return null;
  }

  const durations = [1440, 4320, 10080, 43200];
  return durations[Math.min(recentViolationCount - 2, durations.length - 1)];
}

function normalizeMessage(text: string): NormalizedMessage {
  const raw = text.normalize("NFKC").toLowerCase();

  return {
    raw,
    rawCompact: compact(raw),
    latinCompact: compact(foldCharacters(raw, latinFoldMap)),
    cyrillicCompact: compact(foldCharacters(raw, cyrillicFoldMap))
  };
}

function foldCharacters(text: string, map: Record<string, string>) {
  return [...text].map((character) => map[character] ?? character).join("");
}

function compact(text: string) {
  return text.replace(/[^\p{L}\p{N}]+/gu, "");
}

function formatDuration(minutes: number | null) {
  if (!minutes) {
    return "0 минут";
  }

  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return `${days} дн.`;
  }

  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours} ч.`;
  }

  return `${minutes} мин.`;
}

function buildOutcomeMessage(
  reason: ModerationReason,
  action: ModerationActionDto,
  muteDurationMinutes: number | null,
  jailDurationMinutes: number | null
) {
  if (action === "user_jailed") {
    return `Сообщение не отправлено: ${reasonLabel[reason]}. Игрок отправлен в тюрьму на ${formatDuration(jailDurationMinutes)}.`;
  }

  if (action === "user_muted") {
    return `Сообщение не отправлено: ${reasonLabel[reason]}. Общий чат замьючен на ${formatDuration(muteDurationMinutes)}.`;
  }

  return `Сообщение не отправлено: ${reasonLabel[reason]}. Это предупреждение; следующий рецидив может дать мут общего чата.`;
}
