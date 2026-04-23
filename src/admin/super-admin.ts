import { getCallerClient } from "./caller-client";
import { AuthAdminError } from "./links";

export async function promoteToSuperAdmin(args: {
  userId: string;
  reason: string;
  callerJwt: string;
}): Promise<void> {
  if (!args.callerJwt) throw new Error("callerJwt is required");
  if (!args.userId) throw new Error("userId is required");
  if (!args.reason || args.reason.trim().length < 5) {
    throw new Error("reason must be at least 5 chars");
  }

  const sb = getCallerClient({ callerJwt: args.callerJwt });
  const { error } = await sb.rpc("promote_to_super_admin", {
    p_user_id: args.userId,
    p_reason: args.reason,
  });
  if (error) {
    throw new AuthAdminError(
      error.message ?? "promote_to_super_admin failed",
      "UNKNOWN",
      (error as { status?: number }).status ?? 0,
    );
  }
}

export async function demoteFromSuperAdmin(args: {
  userId: string;
  reason: string;
  callerJwt: string;
}): Promise<void> {
  if (!args.callerJwt) throw new Error("callerJwt is required");
  if (!args.userId) throw new Error("userId is required");
  if (!args.reason || args.reason.trim().length < 5) {
    throw new Error("reason must be at least 5 chars");
  }

  const sb = getCallerClient({ callerJwt: args.callerJwt });
  const { error } = await sb.rpc("demote_from_super_admin", {
    p_user_id: args.userId,
    p_reason: args.reason,
  });
  if (error) {
    throw new AuthAdminError(
      error.message ?? "demote_from_super_admin failed",
      "UNKNOWN",
      (error as { status?: number }).status ?? 0,
    );
  }
}
