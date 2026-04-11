"use client";

import { Plus, MessageSquare, Trash2, Zap, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  cliMode: boolean;
}

function groupByDate(conversations: Conversation[]) {
  const now = Date.now();
  const dayMs = 86_400_000;
  const todayStart = now - (now % dayMs);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of conversations) {
    if (c.updatedAt >= todayStart) groups[0].items.push(c);
    else if (c.updatedAt >= todayStart - dayMs) groups[1].items.push(c);
    else if (c.updatedAt >= todayStart - 7 * dayMs) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

function UserSection() {
  const { user, loading, signOut } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <a
        href="/login"
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Sign in to sync</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.user_metadata?.avatar_url && (
        <img
          src={user.user_metadata.avatar_url}
          alt=""
          className="w-5 h-5 rounded-full"
        />
      )}
      <span className="text-xs truncate flex-1">
        {user.user_metadata?.full_name || user.email}
      </span>
      <button
        onClick={signOut}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Sign out"
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  cliMode,
}: SidebarProps) {
  const groups = groupByDate(
    [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
  );

  return (
    <aside className="w-[260px] h-full flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={onNew}
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1 px-2">
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </div>
              {group.items.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors duration-150",
                    activeId === conv.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  <span className="truncate flex-1">{conv.title}</span>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.stopPropagation(); onDelete(conv.id); }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive cursor-pointer"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </ScrollArea>

      {/* Bottom: User + CLI Status */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {cliMode ? (
          <div className="flex items-center gap-2 text-xs text-primary">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-medium">CLI Mode Active</span>
            <span className="text-muted-foreground">· $0/request</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>API Key Mode</span>
          </div>
        )}
        <UserSection />
      </div>
    </aside>
  );
}
