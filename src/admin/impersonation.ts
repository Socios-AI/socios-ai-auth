import { getCallerClient } from "./caller-client";
import { AuthAdminError } from "./links";

function classifyRpcError(message: string | undefined, status: number | undefined): "UNAUTHORIZED" | "RATE_LIMITED" | "UNKNOWN" {
  if (!message) return "UNKNOWN";
  if (/only super_admin|MFA verification required|not authenticated/i.test(message)) return "UNAUTHORIZED";
  if (status === 429) return "RATE_LIMITED";
  return "UNKNOWN";
}

export async function startImpersonation(args: {
  targetUserId: string;
  reason: string;
  callerJwt: string;
}): Promise<{ sessionId: string; actorUserId: string; targetUserId: string; expiresAt: string }> {
  if (!args.callerJwt) throw new Error("callerJwt is required");
  if (!args.targetUserId) throw new Error("targetUserId is required");
  if (!args.reason || args.reason.trim().length < 5) throw new Error("reason must be at least 5 chars");

  const sb = getCallerClient({ callerJwt: args.callerJwt });
  const { data, error } = await sb.rpc("start_impersonation", {
    p_target_user_id: args.targetUserId,
    p_reason: args.reason,
  });
  if (error) {
    throw new AuthAdminError(
      error.message ?? "start_impersonation failed",
      classifyRpcError(error.message, (error as { status?: number }).status),
      (error as { status?: number }).status ?? 0,
    );
  }
  return {
    sessionId: data.session_id,
    actorUserId: data.actor_user_id,
    targetUserId: data.target_user_id,
    expiresAt: data.expires_at,
  };
}

export async function endImpersonation(args: {
  sessionId: string;
  callerJwt: string;
}): Promise<{ endedAt: string }> {
  if (!args.callerJwt) throw new Error("callerJwt is required");
  if (!args.sessionId) throw new Error("sessionId is required");
  const sb = getCallerClient({ callerJwt: args.callerJwt });
  const { error } = await sb.rpc("end_impersonation", { p_session_id: args.sessionId });
  if (error) {
    throw new AuthAdminError(
      error.message ?? "end_impersonation failed",
      classifyRpcError(error.message, (error as { status?: number }).status),
      (error as { status?: number }).status ?? 0,
    );
  }
  return { endedAt: new Date().toISOString() };
}
