import { getSupabaseAdminClient } from "./client";
import { generateInviteLink, AuthAdminError } from "./links";

export async function createUserWithMembership(args: {
  email: string;
  fullName: string;
  appSlug: string;
  roleSlug: string;
  orgId?: string;
  redirectTo: string;
}): Promise<{ userId: string; actionLink: string }> {
  if (!args.email) throw new Error("email is required");
  if (!args.fullName) throw new Error("fullName is required");
  if (!args.appSlug) throw new Error("appSlug is required");
  if (!args.roleSlug) throw new Error("roleSlug is required");
  if (!args.redirectTo) throw new Error("redirectTo is required");

  const sb = getSupabaseAdminClient();
  const params: Record<string, string> = {
    p_email: args.email,
    p_full_name: args.fullName,
    p_app_slug: args.appSlug,
    p_role_slug: args.roleSlug,
  };
  if (args.orgId) params.p_org_id = args.orgId;

  const { data, error } = await sb.rpc("create_user_with_membership", params);
  if (error) {
    throw new AuthAdminError(
      error.message ?? "create_user_with_membership failed",
      "UNKNOWN",
      (error as { status?: number }).status ?? 0,
    );
  }

  const userId = typeof data === "string" ? data : "";
  if (!userId) {
    throw new AuthAdminError("create_user_with_membership returned no user_id", "UNKNOWN", 0);
  }

  const link = await generateInviteLink({
    email: args.email,
    redirectTo: args.redirectTo,
    fallbackToRecovery: true,
  });

  return { userId, actionLink: link.actionLink };
}
