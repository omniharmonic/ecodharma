import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { exportUserData } from "@/lib/account";

// GET /api/export — downloads the signed-in user's complete data as JSON.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const data = await exportUserData(user.id, user.email);
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="ecodharma-export-${user.id}.json"`,
      "cache-control": "no-store",
    },
  });
}
