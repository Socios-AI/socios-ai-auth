import { getSupabaseAdminClient } from "./client";

export class AuthAdminError extends Error {
  constructor(
    message: string,
    public readonly code: "EMAIL_EXISTS" | "RATE_LIMITED" | "UNAUTHORIZED" | "UNKNOWN",
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthAdminError";
  }
}

type GenerateLinkResponse = {
  action_link: string;
  hashed_token: string;
};

type GenerateLinkErrorBody = {
  code?: number;
  error_code?: string;
  msg?: string;
};

async function callGenerateLink(args: {
  type: "invite" | "recovery";
  email: string;
  redirectTo: string;
}): Promise<GenerateLinkResponse> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase URL or service role key");

  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: args.type,
      email: args.email,
      redirect_to: args.redirectTo,
    }),
  }).catch((err) => {
    throw new AuthAdminError(`Network error: ${err.message}`, "UNKNOWN", 0);
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as GenerateLinkErrorBody;
    if (response.status === 422 && body.error_code === "email_exists") {
      throw new AuthAdminError(body.msg ?? "Email already exists", "EMAIL_EXISTS", 422);
    }
    if (response.status === 429) {
      throw new AuthAdminError(body.msg ?? "Rate limited", "RATE_LIMITED", 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw new AuthAdminError(body.msg ?? "Unauthorized", "UNAUTHORIZED", response.status);
    }
    throw new AuthAdminError(body.msg ?? "Unknown error", "UNKNOWN", response.status);
  }

  return (await response.json()) as GenerateLinkResponse;
}

export async function generateRecoveryLink(args: {
  email: string;
  redirectTo: string;
}): Promise<{ actionLink: string; hashedToken: string }> {
  getSupabaseAdminClient();
  const res = await callGenerateLink({ type: "recovery", email: args.email, redirectTo: args.redirectTo });
  return {
    actionLink: res.action_link,
    hashedToken: res.hashed_token,
  };
}

export async function generateInviteLink(args: {
  email: string;
  redirectTo: string;
  fallbackToRecovery?: boolean;
}): Promise<{ actionLink: string; hashedToken: string; usedFallback: boolean }> {
  getSupabaseAdminClient();
  const fallback = args.fallbackToRecovery ?? true;

  try {
    const res = await callGenerateLink({ type: "invite", email: args.email, redirectTo: args.redirectTo });
    return {
      actionLink: res.action_link,
      hashedToken: res.hashed_token,
      usedFallback: false,
    };
  } catch (err) {
    if (err instanceof AuthAdminError && err.code === "EMAIL_EXISTS" && fallback) {
      const res = await callGenerateLink({ type: "recovery", email: args.email, redirectTo: args.redirectTo });
      return {
        actionLink: res.action_link,
        hashedToken: res.hashed_token,
        usedFallback: true,
      };
    }
    throw err;
  }
}
