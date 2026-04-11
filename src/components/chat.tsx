"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { getApiKeys, hasAnyApiKey } from "@/lib/api-keys";
import { Message, TaskCategory, ModelProvider, Conversation } from "@/lib/types";
import { createConversation } from "@/lib/conversations";
import Markdown from "@/components/markdown";
import { useAuth } from "@/lib/auth-context";
import { cloudStorage } from "@/lib/storage";

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  coding: "Coding",
  writing: "Writing",
  analysis: "Analysis",
  math_reasoning: "Math & Reasoning",
  image_multimodal: "Multimodal",
  large_document: "Document",
  general: "General",
};

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  coding: "bg-violet-500/10 text-violet-400 border-violet-500/20 dark:text-violet-400",
  writing: "bg-pink-500/10 text-pink-500 border-pink-500/20 dark:text-pink-400",
  analysis: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  math_reasoning: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  image_multimodal: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400",
  large_document: "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-400",
  general: "bg-slate-500/10 text-slate-500 border-slate-500/20 dark:text-slate-400",
};

const EXAMPLE_PROMPTS = [
  { text: "Write a Python sorting algorithm", category: "coding" as TaskCategory },
  { text: "Explain quantum computing simply", category: "general" as TaskCategory },
  { text: "Analyze pros and cons of remote work", category: "analysis" as TaskCategory },
  { text: "Solve: integral of x² · eˣ dx", category: "math_reasoning" as TaskCategory },
];

interface RouteInfo {
  model: string;
  modelId: string;
  provider: ModelProvider;
  category: TaskCategory;
  reasoning: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
}

interface ChatProps {
  conversation: Conversation | null;
  onConversationUpdate: (conversation: Conversation) => void;
  cliMode: boolean;
}

export default function Chat({ conversation, onConversationUpdate, cliMode }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingRoute, setStreamingRoute] = useState<RouteInfo | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [cloudKeys, setCloudKeys] = useState<Record<string, string> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Load cloud API keys if logged in
  useEffect(() => {
    if (user) {
      cloudStorage.getApiKeys().then(setCloudKeys).catch(() => setCloudKeys(null));
    }
  }, [user]);

  // Load messages from conversation
  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages);
      setTotalCost(
        conversation.messages.reduce((sum, m) => sum + (m.cost ?? 0), 0)
      );
    } else {
      setMessages([]);
      setTotalCost(0);
    }
  }, [conversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSubmit = async (overrideInput?: string) => {
    const trimmed = (overrideInput ?? input).trim();
    if (!trimmed || isLoading) return;

    const apiKeys = user && cloudKeys ? cloudKeys : getApiKeys();
    if (!cliMode && !hasAnyApiKey(apiKeys)) {
      alert("Please add at least one API key in Settings first.");
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");
    setStreamingRoute(null);

    // Create or update conversation
    const conv = conversation ?? createConversation(trimmed);
    conv.messages = updatedMessages;
    conv.updatedAt = Date.now();

    try {
      const chatMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages, apiKeys }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get response");
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let routeInfo: RouteInfo | null = null;
      let inputTokens = 0;
      let outputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let chunk = decoder.decode(value, { stream: true });

        // Parse [ROUTE] metadata prefix
        if (chunk.includes("[ROUTE]")) {
          const routeMatch = chunk.match(/\[ROUTE\]([\s\S]*?)\n\n/);
          if (routeMatch) {
            try {
              routeInfo = JSON.parse(routeMatch[1]);
              setStreamingRoute(routeInfo);
            } catch {
              // skip
            }
            chunk = chunk.replace(/\[ROUTE\][\s\S]*?\n\n/, "");
          }
        }

        // Parse [META] suffix with token counts — also handle without \n\n prefix (CLI mode)
        if (chunk.includes("[META]")) {
          const metaMatch = chunk.match(/(\n\n)?\[META\]([\s\S]*)/);
          if (metaMatch) {
            try {
              const meta = JSON.parse(metaMatch[2]);
              inputTokens = meta.inputTokens || 0;
              outputTokens = meta.outputTokens || 0;
            } catch {
              // skip
            }
            chunk = chunk.replace(/(\n\n)?\[META\][\s\S]*/, "");
          }
        }

        if (chunk) {
          fullContent += chunk;
          setStreamingContent(fullContent);
        }
      }

      // Calculate cost
      let cost = 0;
      if (routeInfo && (inputTokens > 0 || outputTokens > 0)) {
        cost =
          (inputTokens / 1_000_000) * routeInfo.inputCostPer1M +
          (outputTokens / 1_000_000) * routeInfo.outputCostPer1M;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        model: routeInfo?.model,
        provider: routeInfo?.provider,
        category: routeInfo?.category,
        inputTokens,
        outputTokens,
        cost,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setTotalCost((prev) => prev + cost);
      setStreamingContent("");
      setStreamingRoute(null);

      // Persist conversation
      conv.messages = finalMessages;
      conv.updatedAt = Date.now();
      onConversationUpdate(conv);
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      setStreamingContent("");
      setStreamingRoute(null);

      conv.messages = finalMessages;
      conv.updatedAt = Date.now();
      onConversationUpdate(conv);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && !streamingContent ? (
          /* Empty State with Example Prompts */
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-6 max-w-lg fade-in">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  LLM Smart Router
                </h2>
                <p className="text-sm">
                  AI automatically picks the best model for your task.
                  {cliMode && (
                    <span className="text-primary font-medium"> CLI Mode — $0 cost.</span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example.text}
                    onClick={() => handleSubmit(example.text)}
                    className="text-left p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group"
                  >
                    <span className="text-sm text-foreground/80 group-hover:text-foreground">
                      {example.text}
                    </span>
                    <Badge
                      variant="outline"
                      className={`mt-2 text-xs ${CATEGORY_COLORS[example.category]}`}
                    >
                      {CATEGORY_LABELS[example.category]}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} slide-up`}
              >
                <Card
                  className={`max-w-[85%] p-4 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 glass"
                  }`}
                >
                  <div className="text-sm prose-sm">
                    {msg.role === "assistant" ? (
                      <Markdown content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                  {msg.role === "assistant" && msg.model && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                      <Badge variant="outline" className="text-xs">
                        {msg.model}
                      </Badge>
                      {msg.category && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${CATEGORY_COLORS[msg.category]}`}
                        >
                          {CATEGORY_LABELS[msg.category]}
                        </Badge>
                      )}
                      {msg.cost !== undefined && msg.cost > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          ${msg.cost.toFixed(6)}
                        </span>
                      ) : cliMode ? (
                        <span className="text-xs text-primary">$0</span>
                      ) : null}
                    </div>
                  )}
                </Card>
              </div>
            ))}

            {/* Streaming message */}
            {isLoading && (
              <div className="flex justify-start slide-up">
                <Card className="max-w-[85%] p-4 bg-muted/50 glass">
                  {streamingContent ? (
                    <>
                      <div className="text-sm prose-sm">
                        <Markdown content={streamingContent} />
                        <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />
                      </div>
                      {streamingRoute && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                          <Badge variant="outline" className="text-xs">
                            {streamingRoute.model}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${CATEGORY_COLORS[streamingRoute.category]}`}
                          >
                            {CATEGORY_LABELS[streamingRoute.category]}
                          </Badge>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Routing to best model...
                      </span>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Cost Indicator */}
      {totalCost > 0 && (
        <div className="text-center text-xs text-muted-foreground py-1">
          Session cost: ${totalCost.toFixed(6)}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border/50 p-4 glass">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send)"
            className="min-h-[44px] max-h-[200px] resize-none bg-secondary/50 border-border/50 focus:border-primary/50"
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSubmit()}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="shrink-0 h-[44px] w-[44px]"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground/50 mt-2">
          Smart Router auto-selects the best model for each task
        </p>
      </div>
    </div>
  );
}
