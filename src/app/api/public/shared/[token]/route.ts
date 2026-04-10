import { NextRequest } from "next/server";
import { getCollectionByShareToken } from "@/lib/data/public";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Get an unlisted (or public) collection by share token
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const data = await getCollectionByShareToken(token);
  if (!data) return errorResponse("Collection not found", 404);
  return jsonResponse(data);
}
