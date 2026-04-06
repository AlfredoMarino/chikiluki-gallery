import { auth } from "./config";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get the current authenticated session or throw.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Get the Google OAuth access token for the current user.
 * Used to make Google Drive API calls.
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  if (!account?.access_token) {
    throw new Error("No Google account linked");
  }

  // Check if token is expired and refresh if needed
  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    if (!account.refresh_token) {
      throw new Error("No refresh token available. Please re-authenticate.");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await response.json();

    if (!response.ok) {
      throw new Error("Failed to refresh Google access token");
    }

    // Update token in database
    await db
      .update(accounts)
      .set({
        access_token: tokens.access_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      })
      .where(eq(accounts.id, account.id));

    return tokens.access_token;
  }

  return account.access_token;
}
