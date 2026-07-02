"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { isPremium } from "@/lib/billing";
import { issueMcpToken, revokeMcpTokens } from "@/lib/mcp-auth";

type McpState = { error?: string; ok?: string; token?: string } | null;

/** Premium: issue a bearer token for the hosted MCP endpoint (revokes prior ones). */
export async function issueMcpTokenAction(_prev: McpState, _formData: FormData): Promise<McpState> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isPremium(user!.id))) return { error: "The MCP is a premium companion." };
  const token = await issueMcpToken(user!.id);
  revalidatePath("/settings");
  return { token };
}

export async function revokeMcpTokenAction(_prev: McpState, _formData: FormData): Promise<McpState> {
  const user = await getUser();
  if (!user) redirect("/login");
  await revokeMcpTokens(user!.id);
  revalidatePath("/settings");
  return { ok: "MCP access revoked." };
}
