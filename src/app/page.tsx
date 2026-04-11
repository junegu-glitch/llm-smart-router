"use client";

import { useState, useEffect, useCallback } from "react";
import Chat from "@/components/chat";
import SettingsDialog from "@/components/settings-dialog";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Conversation, Message } from "@/lib/types";
import {
  getConversations,
  saveConversation,
  deleteConversation,
} from "@/lib/conversations";
import { useAuth } from "@/lib/auth-context";
import { cloudStorage } from "@/lib/storage";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cliMode, setCliMode] = useState(false);
  const { user } = useAuth();

  // Load conversations from cloud or localStorage
  const loadConversations = useCallback(async () => {
    if (user) {
      const cloudConvs = await cloudStorage.getConversations();
      // Convert cloud format to local Conversation type
      const convs: Conversation[] = await Promise.all(
        cloudConvs.map(async (c) => {
          const msgs = await cloudStorage.getMessages(c.id);
          return {
            id: c.id,
            title: c.title,
            messages: msgs.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              model: m.model,
              provider: m.provider,
              category: m.category,
              inputTokens: m.inputTokens,
              outputTokens: m.outputTokens,
              costUsd: m.costUsd,
              timestamp: new Date(m.createdAt).getTime(),
            }) as Message),
            createdAt: new Date(c.createdAt).getTime(),
            updatedAt: new Date(c.updatedAt).getTime(),
          };
        })
      );
      setConversations(convs);
    } else {
      setConversations(getConversations());
    }
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Check CLI mode
  useEffect(() => {
    fetch("/api/cli-status")
      .then((res) => res.json())
      .then((data) => setCliMode(data.cliMode === true))
      .catch(() => setCliMode(false));
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveId(null);
    setSidebarOpen(false);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      if (user) {
        await cloudStorage.deleteConversation(id);
      } else {
        deleteConversation(id);
      }
      await loadConversations();
      if (activeId === id) setActiveId(null);
    },
    [activeId, user, loadConversations]
  );

  const handleConversationUpdate = useCallback(async (conversation: Conversation) => {
    if (user) {
      // Save conversation to cloud
      await cloudStorage.saveConversation({
        id: conversation.id,
        title: conversation.title,
        createdAt: new Date(conversation.createdAt).toISOString(),
        updatedAt: new Date(conversation.updatedAt).toISOString(),
      });
      // Save the latest message to cloud
      const lastMsg = conversation.messages[conversation.messages.length - 1];
      if (lastMsg && (lastMsg.role === "user" || lastMsg.role === "assistant")) {
        await cloudStorage.saveMessage({
          id: crypto.randomUUID(),
          conversationId: conversation.id,
          role: lastMsg.role as "user" | "assistant",
          content: lastMsg.content,
          model: lastMsg.model,
          provider: lastMsg.provider,
          category: lastMsg.category,
          inputTokens: lastMsg.inputTokens,
          outputTokens: lastMsg.outputTokens,
          costUsd: lastMsg.cost,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      saveConversation(conversation);
    }
    await loadConversations();
    setActiveId(conversation.id);
  }, [user, loadConversations]);

  const activeConversation = activeId
    ? conversations.find((c) => c.id === activeId) ?? null
    : null;

  const sidebarContent = (
    <Sidebar
      conversations={conversations}
      activeId={activeId}
      onSelect={handleSelectConversation}
      onNew={handleNewChat}
      onDelete={handleDeleteConversation}
      cliMode={cliMode}
    />
  );

  return (
    <div className="h-screen flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" showCloseButton={false} className="p-0 w-[260px]">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          cliMode={cliMode}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="flex-1 overflow-hidden">
          <Chat
            conversation={activeConversation}
            onConversationUpdate={handleConversationUpdate}
            cliMode={cliMode}
          />
        </main>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        externalOpen={settingsOpen}
        onExternalOpenChange={setSettingsOpen}
      />
    </div>
  );
}
