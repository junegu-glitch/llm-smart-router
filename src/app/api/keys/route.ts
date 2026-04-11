import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/encryption";

// GET /api/keys — list user's API keys (decrypted)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("provider, encrypted_key, iv")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Decrypt keys for the client
  const decrypted: Record<string, string> = {};
  for (const row of keys ?? []) {
    try {
      decrypted[row.provider] = decrypt(row.encrypted_key, row.iv);
    } catch {
      // Skip corrupted keys
    }
  }

  return NextResponse.json({ keys: decrypted });
}

// POST /api/keys — save/update an API key
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, key } = body as { provider: string; key: string };

  if (!provider || !key) {
    return NextResponse.json({ error: "provider and key required" }, { status: 400 });
  }

  const { encrypted, iv } = encrypt(key);

  const { error } = await supabase
    .from("api_keys")
    .upsert(
      { user_id: user.id, provider, encrypted_key: encrypted, iv, updated_at: new Date().toISOString() },
      { onConflict: "user_id,provider" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/keys — remove an API key
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await request.json();

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
