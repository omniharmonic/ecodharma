"use server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isPremium } from "@/lib/billing";
import { createLinkCode } from "@/lib/bot";

type BotLinkState = { error?: string; code?: string; link?: string } | null;

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

/** Premium: mint a one-time code to connect a Telegram account to this user. */
export async function createBotLinkAction(_prev: BotLinkState, _formData: FormData): Promise<BotLinkState> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isPremium(user!.id))) return { error: "Reflection is a premium companion." };
  const code = await createLinkCode(user!.id);
  const link = BOT ? `https://t.me/${BOT}?start=${code}` : undefined;
  return { code, link };
}
