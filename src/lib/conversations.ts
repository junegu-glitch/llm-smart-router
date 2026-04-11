import { Conversation } from "./types";

const STORAGE_KEY = "llm-router-conversations";

export function getConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getConversation(id: string): Conversation | null {
  return getConversations().find((c) => c.id === id) ?? null;
}

export function saveConversation(conversation: Conversation): void {
  const all = getConversations();
  const idx = all.findIndex((c) => c.id === conversation.id);
  if (idx >= 0) {
    all[idx] = conversation;
  } else {
    all.push(conversation);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteConversation(id: string): void {
  const all = getConversations().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function createConversation(firstMessage?: string): Conversation {
  return {
    id: crypto.randomUUID(),
    title: firstMessage
      ? firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : "")
      : "New Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
