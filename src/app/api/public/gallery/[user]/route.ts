import { NextRequest } from "next/server";
import { getPublicCollectionsByUser } from "@/lib/data/public";
import { jsonResponse } from "@/lib/utils";

// Get public collections for a user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
) {
  const { user: userName } = await params;
  const result = await getPublicCollectionsByUser(userName);
  return jsonResponse(result);
}
