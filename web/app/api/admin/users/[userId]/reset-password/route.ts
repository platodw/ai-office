import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Params = { params: Promise<{ userId: string }> };

// POST /api/admin/users/[userId]/reset-password
// Returns the reset link (admin copies it or we could email it)
export async function POST(_request: Request, { params }: Params) {
  await requireAdmin();
  const { userId } = await params;
  const admin = createServiceClient();

  // Get email for this user
  const { data: { user }, error: getUserErr } = await admin.auth.admin.getUserById(userId);
  if (getUserErr || !user?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://aioffice.danplato.com"}/auth/callback?type=recovery`,
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ link: data.properties.action_link, email: user.email });
}
