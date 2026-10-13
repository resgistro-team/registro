import { NextResponse, type NextRequest } from "next/server";
import { authConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (!authConfigured) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // Skip build output, the hero's imagery and other static files.
  matcher: ["/((?!_next/static|_next/image|hero/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|bin)$).*)"],
};
