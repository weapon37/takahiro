import { checkDatabaseConnection, isDatabaseConfigured } from "@/lib/db";
import { isXConfigured } from "@/lib/x-client";

export interface StatusSummary {
  anthropic: { configured: boolean };
  database: { configured: boolean; connected: boolean; error?: string };
  x: { configured: boolean };
  cron: { secretConfigured: boolean };
}

export async function getStatusSummary(): Promise<StatusSummary> {
  const dbConfigured = isDatabaseConfigured();
  let database: StatusSummary["database"] = {
    configured: dbConfigured,
    connected: false,
  };

  if (dbConfigured) {
    const result = await checkDatabaseConnection();
    database = {
      configured: true,
      connected: result.ok,
      error: result.ok ? undefined : result.error,
    };
  }

  return {
    anthropic: { configured: Boolean(process.env.ANTHROPIC_API_KEY) },
    database,
    x: { configured: isXConfigured() },
    cron: { secretConfigured: Boolean(process.env.CRON_SECRET) },
  };
}
