/**
 * Script to fully reset auth state in the database.
 * Run with: npx tsx scripts/reset-tokens.ts
 *
 * After running, log in again to get fresh tokens
 * with the correct Google Drive scope.
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Show current state
  const users = await sql`SELECT id, email FROM users`;
  console.log("Current users:", users);

  // Clear everything auth-related (order matters for FK constraints)
  await sql`DELETE FROM sessions`;
  await sql`DELETE FROM accounts`;
  await sql`DELETE FROM users`;

  console.log("\nAuth state fully reset. Now:");
  console.log("1. Go to http://localhost:3000");
  console.log("2. Log in with Google again");
  console.log("3. Accept Drive permissions");
  console.log("4. Try uploading");
}

main().catch(console.error);
