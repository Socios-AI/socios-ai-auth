import { getCallerClient } from "./caller-client";
import { AuthAdminError } from "./links";

export async function grantMembership(args: {
  userId: string;
  appSlug: string;
  roleSlug: string;
  orgId?: string;
  callerJwt: string;
}): Promise<{ membershipId: string }> {
  if (!args.callerJwt) throw new Error("callerJwt is required");
  if (!args.userId) throw new Error("userId is required");
  if (!args.appSlug) throw new Error("appSlug is required");
  if (!args.roleSlug) throw new Error("roleSlug is required");

  const sb = getCallerClient({ callerJwt: args.callerJwt });
  const params: Record<string, string> = {
    p_user_id: args.userId,
    p_app_slug: args.appSlug,
    p_role_slug: args.roleSlug,
  };
  if (args.orgId) params.p_org_id = args.orgId;

  const { data, error } = await sb.rpc("grant_membership", params);
  if (error) {
    throw new AuthAdminError(error.message ?? "grant_membership failed", "UNKNOWN", (error as { status?: number }).status ?? 0);
  }
  return { membershipId: typeof data === "string" ? data : "" };
}

export async function revokeMembership(args: {
  membershipId: string;
  reason: string;
  callerJwt: string;
}): Promise<{ revokedAt: string }> {
  if (!args.callerJwt) throw new Error("callerJwt is required");
  if (!args.membershipId) throw new Error("membershipId is required");
  if (!args.reason || args.reason.trim().length < 5) throw new Error("reason must be at least 5 chars");

  const sb = getCallerClient({ callerJwt: args.callerJwt });
  const { data, error } = await sb.rpc("revoke_membership", {
    p_membership_id: args.membershipId,
    p_reason: args.reason,
  });
  if (error) {
    throw new AuthAdminError(error.message ?? "revoke_membership failed", "UNKNOWN", (error as { status?: number }).status ?? 0);
  }
  return { revokedAt: typeof data === "string" ? data : "" };
}
