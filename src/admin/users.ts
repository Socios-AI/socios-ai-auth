import { getSupabaseAdminClient } from "./client";
import { generateInviteLink, AuthAdminError } from "./links";

export async function createUserWithMembership(args: {
  email: string;
  appSlug: string;
  roleSlug: string;
  orgId?: string;
  redirectTo: string;
}): Promise<{ userId: string; membershipId: string; actionLink: string }> {
  if (!args.email) throw new Error("email is required");
  if (!args.appSlug) throw new Error("appSlug is required");
  if (!args.roleSlug) throw new Error("roleSlug is required");
  if (!args.redirectTo) throw new Error("redirectTo is required");

  const sb = getSupabaseAdminClient();
  const params: Record<string, string> = {
    p_email: args.email,
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

  // Generate the invite link (with fallback to recovery if email already exists)
  const link = await generateInviteLink({
    email: args.email,
    redirectTo: args.redirectTo,
    fallbackToRecovery: true,
  });

  return {
    userId: (data as { user_id: string }).user_id,
    membershipId: (data as { membership_id: string }).membership_id,
    actionLink: link.actionLink,
  };
}
