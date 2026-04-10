import { NextRequest } from "next/server";
import { getPublicCollectionBySlug } from "@/lib/data/public";
import { jsonResponse, errorResponse } from "@/lib/utils";

// Get a public collection with its photos
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ user: string; slug: string }> }
) {
  const { user: userName, slug } = await params;
  const data = await getPublicCollectionBySlug(userName, slug);
  if (!data) return errorResponse("Collection not found", 404);
  return jsonResponse(data);
}
