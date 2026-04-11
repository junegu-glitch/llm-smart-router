"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ApiKeys, ModelProvider } from "@/lib/types";
import { getApiKeys, saveApiKeys, PROVIDER_INFO } from "@/lib/api-keys";
import { AVAILABLE_MODELS } from "@/lib/models";
import { useAuth } from "@/lib/auth-context";
import { cloudStorage } from "@/lib/storage";

interface SettingsDialogProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export default function SettingsDialog({ externalOpen, onExternalOpenChange }: SettingsDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const [keys, setKeys] = useState<ApiKeys>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [cliMode, setCliMode] = useState(false);
  const [cliProviders, setCliProviders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      try {
        if (user) {
          const cloudKeys = await cloudStorage.getApiKeys();
          if (!cancelled) {
            setKeys(cloudKeys as ApiKeys);
            setSynced(true);
          }
        } else if (!cancelled) {
          setKeys(getApiKeys());
          setSynced(false);
        }
      } catch {
        if (!cancelled) {
          setKeys(getApiKeys());
          setSynced(false);
        }
      }

      try {
        const res = await fetch("/api/cli-status");
        const data = await res.json();
        if (!cancelled) {
          setCliMode(data.cliMode === true);
          setCliProviders(data.providers || []);
        }
      } catch {
        if (!cancelled) {
          setCliMode(false);
          setCliProviders([]);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const handleSave = async () => {
    setSaving(true);
    if (user) {
      // Save each key to Supabase (only changed/non-empty ones)
      for (const [provider, key] of Object.entries(keys)) {
        if (key && key.trim()) {
          await cloudStorage.setApiKey(provider, key.trim());
        } else {
          await cloudStorage.removeApiKey(provider);
        }
      }
      setSynced(true);
    } else {
      saveApiKeys(keys);
    }
    setSaving(false);
    setOpen(false);
  };

  const providers = Object.entries(PROVIDER_INFO) as [
    ModelProvider,
    (typeof PROVIDER_INFO)[ModelProvider],
  ][];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            API Key Settings (BYOK)
            {user && synced && (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs font-normal">
                ☁ Synced
              </Badge>
            )}
            {!user && (
              <a href="/login" className="text-xs text-blue-500 hover:underline font-normal">
                Sign in to sync across devices
              </a>
            )}
          </DialogTitle>
        </DialogHeader>
        {cliMode ? (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <p className="text-sm font-medium text-green-500">
              CLI Mode Active — No API keys needed
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Using your installed CLI subscriptions ({cliProviders.join(", ")}).
              Cost: $0 per request.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your API keys are stored locally in your browser. They are never sent
            to our servers — they go directly to each AI provider.
          </p>
        )}

        <div className="space-y-6 mt-4">
          {providers.map(([provider, info]) => {
            const models = AVAILABLE_MODELS.filter(
              (m) => m.provider === provider
            );
            const isConfigured = keys[provider] && keys[provider]!.trim().length > 0;

            return (
              <div key={provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      {info.name}
                      {isConfigured && (
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-500 border-green-500/20 text-xs"
                        >
                          Connected
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {info.description}
                    </p>
                  </div>
                  <a
                    href={info.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Get API Key
                  </a>
                </div>
                <div className="flex gap-2">
                  <Input
                    type={showKeys[provider] ? "text" : "password"}
                    value={keys[provider] || ""}
                    onChange={(e) =>
                      setKeys({ ...keys, [provider]: e.target.value })
                    }
                    placeholder={info.placeholder}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setShowKeys({ ...showKeys, [provider]: !showKeys[provider] })
                    }
                  >
                    {showKeys[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {models.map((m) => (
                    <Badge key={m.id} variant="outline" className="text-xs">
                      {m.name} (${m.outputCostPer1M}/M out)
                    </Badge>
                  ))}
                </div>
                <Separator />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : user ? "Save & Sync" : "Save Keys"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
