const env = (name: string, fallback = ""): string => process.env[name] ?? fallback;

export const config = {
  sessionTtlHours: Number(env("SESSION_TTL_HOURS", "8")) || 8,
  loginMaxAttempts: Number(env("LOGIN_MAX_ATTEMPTS", "5")) || 5,
  loginWindowMinutes: Number(env("LOGIN_WINDOW_MINUTES", "15")) || 15,
  tursoDbUrl: env("TURSO_DB_URL"),
  tursoAuthToken: env("TURSO_AUTH_TOKEN"),
  corsOrigins: env("CORS_ORIGINS", ""),
};