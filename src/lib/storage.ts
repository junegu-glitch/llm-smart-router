import { createClient } from "@/lib/supabase/client";

// ===== Types =====
export interface StoredConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
  category?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  createdAt: string;
}

// ===== localStorage adapter (guest mode) =====
const LS_CONVERSATIONS = "llm-router-conversations";
const LS_MESSAGES = "llm-router-messages";
const LS_KEYS = "llm-router-api-keys";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ===== Guest Storage =====
export const guestStorage = {
  async getConversations(): Promise<StoredConversation[]> {
    return lsGet<StoredConversation[]>(LS_CONVERSATIONS, []);
  },

  async saveConversation(conv: StoredConversation) {
    const all = await this.getConversations();
    const idx = all.findIndex((c) => c.id === conv.id);
    if (idx >= 0) all[idx] = conv;
    else all.unshift(conv);
    lsSet(LS_CONVERSATIONS, all);
  },

  async deleteConversation(id: string) {
    const all = await this.getConversations();
    lsSet(LS_CONVERSATIONS, all.filter((c) => c.id !== id));
    const allMsgs = lsGet<StoredMessage[]>(LS_MESSAGES, []);
    lsSet(LS_MESSAGES, allMsgs.filter((m) => m.conversationId !== id));
  },

  async getMessages(conversationId: string): Promise<StoredMessage[]> {
    const all = lsGet<StoredMessage[]>(LS_MESSAGES, []);
    return all.filter((m) => m.conversationId === conversationId);
  },

  async saveMessage(msg: StoredMessage) {
    const all = lsGet<StoredMessage[]>(LS_MESSAGES, []);
    all.push(msg);
    lsSet(LS_MESSAGES, all);
  },

  getApiKeys(): Record<string, string> {
    return lsGet<Record<string, string>>(LS_KEYS, {});
  },

  setApiKeys(keys: Record<string, string>) {
    lsSet(LS_KEYS, keys);
  },
};

// ===== Cloud Storage (Supabase) =====
export const cloudStorage = {
  async getConversations(): Promise<StoredConversation[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false });

    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async saveConversation(conv: StoredConversation) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("conversations").upsert({
      id: conv.id,
      user_id: user.id,
      title: conv.title,
      updated_at: conv.updatedAt,
    });
  },

  async deleteConversation(id: string) {
    const supabase = createClient();
    await supabase.from("conversations").delete().eq("id", id);
  },

  async getMessages(conversationId: string): Promise<StoredMessage[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    return (data ?? []).map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      model: r.model,
      provider: r.provider,
      category: r.category,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      costUsd: Number(r.cost_usd),
      createdAt: r.created_at,
    }));
  },

  async saveMessage(msg: StoredMessage) {
    const supabase = createClient();
    await supabase.from("messages").insert({
      id: msg.id,
      conversation_id: msg.conversationId,
      role: msg.role,
      content: msg.content,
      model: msg.model,
      provider: msg.provider,
      category: msg.category,
      input_tokens: msg.inputTokens ?? 0,
      output_tokens: msg.outputTokens ?? 0,
      cost_usd: msg.costUsd ?? 0,
    });
  },

  async getApiKeys(): Promise<Record<string, string>> {
    const res = await fetch("/api/keys");
    if (!res.ok) return {};
    const { keys } = await res.json();
    return keys ?? {};
  },

  async setApiKey(provider: string, key: string) {
    await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
  },

  async removeApiKey(provider: string) {
    await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
  },
};
