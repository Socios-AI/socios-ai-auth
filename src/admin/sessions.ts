import { getCallerClient } from "./caller-client";
import { AuthAdminError } from "./links";

export async function forceLogout(args: {
  targetUserId: string;
  reason: string;
  callerJwt: string;
}): Promise<{ revokedSessions: number }> {
  if (!args.callerJwt) throw new Error("callerJwt is required");
  if (!args.targetUserId) throw new Error("targetUserId is required");
  if (!args.reason || args.reason.trim().length < 5) throw new Error("reason must be at least 5 chars");

  const sb = getCallerClient({ callerJwt: args.callerJwt });
  const { error } = await sb.rpc("force_logout", {
    p_user_id: args.targetUserId,
    p_reason: args.reason,
  });
  if (error) {
    throw new AuthAdminError(
      error.message ?? "force_logout failed",
      "UNKNOWN",
      (error as { status?: number }).status ?? 0,
    );
  }
  // RPC returns void; we don't yet surface a per-session count.
  return { revokedSessions: 0 };
}
