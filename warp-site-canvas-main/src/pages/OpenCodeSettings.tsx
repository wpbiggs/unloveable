import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  OpenCode,
  OpenCodeDirectory,
  type OpenCodeProviderAuthMethodsResponse,
  type OpenCodeProviderAuthorization,
  type OpenCodeProviderInfo,
} from "@/lib/opencode-client";
import { OpenCodePreferences } from "@/lib/opencode-preferences";
import { OpenCodeWorkspace } from "@/lib/opencode-workspace";
import { WORKSPACE_TEMPLATES } from "@/lib/workspace-templates";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const OpenCodeSettings = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [providers, setProviders] = useState<OpenCodeProviderInfo[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  const [methods, setMethods] = useState<OpenCodeProviderAuthMethodsResponse>({});
  const [providerID, setProviderID] = useState<string>("openai");
  const [apiKey, setApiKey] = useState<string>("");
  const [directory, setDirectory] = useState<string | null>(() => OpenCodeDirectory.get());
  const [baseURL, setBaseURL] = useState<string>("");
  const [enabledProvidersRaw, setEnabledProvidersRaw] = useState<string>("");
  const [disabledProvidersRaw, setDisabledProvidersRaw] = useState<string>("");
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [smallModel, setSmallModel] = useState<string>("");
  const [agentKeys, setAgentKeys] = useState<string[]>([]);
  const [prefAgent, setPrefAgent] = useState<string | null>(() => OpenCodePreferences.agent.get());
  const [prefModel, setPrefModel] = useState<string | null>(() => OpenCodePreferences.model.get());
  const [workspaceRoot, setWorkspaceRoot] = useState<string>(() => OpenCodeWorkspace.root.get() ?? OpenCodeWorkspace.root.defaultValue);
  const [autoCreateWorkspace, setAutoCreateWorkspace] = useState<boolean>(() => OpenCodeWorkspace.autoCreate.get());
  const [defaultTemplate, setDefaultTemplate] = useState<string>(() => OpenCodeWorkspace.defaultTemplate.get());
  const [linkShared, setLinkShared] = useState<boolean>(() => OpenCodeWorkspace.linkShared.get());
  const [supabaseEnabled, setSupabaseEnabled] = useState<boolean>(() => OpenCodeWorkspace.supabase.enabled.get());
  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => OpenCodeWorkspace.supabase.url.get());
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>(() => OpenCodeWorkspace.supabase.anonKey.get());
  const [shellSessionID, setShellSessionID] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<string>("");

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authFlow, setAuthFlow] = useState<
    | null
    | {
        providerID: string;
        methodIndex: number;
        authorization: OpenCodeProviderAuthorization;
      }
  >(null);
  const [authCode, setAuthCode] = useState<string>("");

  const baseUrl = (import.meta.env.VITE_OPENCODE_URL as string | undefined) || "http://localhost:4096";
  const supabaseStackDir = `${(workspaceRoot.trim() || OpenCodeWorkspace.root.defaultValue).replace(/\/$/, "")}/_infra/supabase`;

  const ensureShellSession = useCallback(async () => {
    if (shellSessionID) return shellSessionID;
    const session = await OpenCode.createSession();
    setShellSessionID(session.id);
    return session.id;
  }, [shellSessionID]);

  const runShell = useCallback(
    async (command: string) => {
      const id = await ensureShellSession();
      return OpenCode.runShell(id, command, { agent: OpenCodePreferences.agent.get() ?? "task" });
    },
    [ensureShellSession],
  );

  const runShellText = useCallback(
    async (command: string) => {
      const id = await ensureShellSession();
      const msg = await OpenCode.runShell(id, command, { agent: OpenCodePreferences.agent.get() ?? "task" });
      const messageID = typeof (msg as any)?.id === "string" ? ((msg as any).id as string) : "";
      if (!messageID) return "";

      const full = await OpenCode.getMessage(id, messageID).catch(() => null);
      const parts = full && Array.isArray((full as any).parts) ? ((full as any).parts as any[]) : [];
      const out: string[] = [];
      for (const p of parts) {
        if (!p || p.type !== "tool") continue;
        const state = p.state;
        if (state?.status === "completed" && typeof state.output === "string" && state.output) out.push(state.output);
        if (state?.status === "error" && typeof state.error === "string" && state.error) out.push(state.error);
      }
      return out.join("\n").trim();
    },
    [ensureShellSession],
  );

  const bootstrapSupabase = useCallback(async () => {
    setIsLoading(true);
    try {
      await runShell(
        `mkdir -p "${supabaseStackDir}" && \
if [ ! -d "${supabaseStackDir}/supabase-upstream/.git" ]; then git clone --depth 1 https://github.com/supabase/supabase "${supabaseStackDir}/supabase-upstream"; fi && \
cp -rf "${supabaseStackDir}/supabase-upstream/docker/"* "${supabaseStackDir}/" && \
test -f "${supabaseStackDir}/.env" || cp "${supabaseStackDir}/.env.example" "${supabaseStackDir}/.env"`,
      );
      toast.success("Supabase stack bootstrapped");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to bootstrap Supabase");
    } finally {
      setIsLoading(false);
    }
  }, [runShell, supabaseStackDir]);

  const generateSupabaseKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      await runShell(`cd "${supabaseStackDir}" && sh ./utils/generate-keys.sh`);
      toast.success("Generated keys in Supabase .env");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate keys");
    } finally {
      setIsLoading(false);
    }
  }, [runShell, supabaseStackDir]);

  const startSupabase = useCallback(async () => {
    setIsLoading(true);
    try {
      await runShell(`cd "${supabaseStackDir}" && docker compose pull && docker compose up -d`);
      toast.success("Supabase stack started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Supabase");
    } finally {
      setIsLoading(false);
    }
  }, [runShell, supabaseStackDir]);

  const supabasePs = useCallback(async () => {
    setIsLoading(true);
    try {
      const out = await runShellText(`cd "${supabaseStackDir}" && docker compose ps`);
      setSupabaseStatus(out);
      toast.success("Supabase status updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get status");
    } finally {
      setIsLoading(false);
    }
  }, [runShellText, supabaseStackDir]);

  const loadSupabaseKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const text = await runShellText(
        `cd "${supabaseStackDir}" && (grep '^ANON_KEY=' .env || true) && (grep '^SUPABASE_PUBLIC_URL=' .env || true)`,
      );
      const anon = /ANON_KEY=(.*)/.exec(text)?.[1]?.trim() ?? "";
      const url = /SUPABASE_PUBLIC_URL=(.*)/.exec(text)?.[1]?.trim() ?? "";
      if (anon) {
        OpenCodeWorkspace.supabase.anonKey.set(anon);
        setSupabaseAnonKey(anon);
      }
      if (url) {
        OpenCodeWorkspace.supabase.url.set(url);
        setSupabaseUrl(url);
      }
      toast.success("Loaded Supabase keys from stack");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read Supabase keys");
    } finally {
      setIsLoading(false);
    }
  }, [runShellText, supabaseStackDir]);

  const writeWorkspaceEnv = useCallback(async () => {
    const target = OpenCodeDirectory.get();
    if (!target) {
      toast.error("Set an OpenCode directory first");
      return;
    }
    const url = supabaseUrl.trim();
    const key = supabaseAnonKey.trim();
    if (!url || !key) {
      toast.error("Set Supabase URL and anon key first");
      return;
    }
    setIsLoading(true);
    try {
      await runShell(
        `test -f "${target}/.env.local" || cat > "${target}/.env.local" <<'EOF'
SUPABASE_URL=${url}
SUPABASE_ANON_KEY=${key}
EOF`,
      );
      toast.success("Wrote .env.local to workspace");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to write workspace env");
    } finally {
      setIsLoading(false);
    }
  }, [runShell, supabaseAnonKey, supabaseUrl]);

  const providerOptions = useMemo(() => {
    const sorted = [...providers].sort((a, b) => a.id.localeCompare(b.id));
    return sorted;
  }, [providers]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await OpenCode.health();
      const [list, authMethods, cfg] = await Promise.all([
        OpenCode.listProviders(),
        OpenCode.providerAuthMethods().catch(() => ({})),
        OpenCode.getConfig().catch(() => ({})),
      ]);
      setProviders(list.all);
      setConnected(list.connected);
      setMethods(authMethods);

      const cfgProvider = (cfg.provider as any)?.[providerID] as any;
      const cfgBase = cfgProvider?.options?.baseURL;
      setBaseURL(typeof cfgBase === "string" ? cfgBase : "");

      const cfgModel = (cfg as any).model;
      setDefaultModel(typeof cfgModel === "string" ? cfgModel : "");
      const cfgSmall = (cfg as any).small_model;
      setSmallModel(typeof cfgSmall === "string" ? cfgSmall : "");

      const agent = (cfg as any).agent;
      const keys = agent && typeof agent === "object" ? Object.keys(agent as Record<string, unknown>) : [];
      setAgentKeys(keys.sort((a, b) => a.localeCompare(b)));

      const enabled = Array.isArray((cfg as any).enabled_providers) ? ((cfg as any).enabled_providers as unknown[]) : [];
      const disabled = Array.isArray((cfg as any).disabled_providers) ? ((cfg as any).disabled_providers as unknown[]) : [];
      setEnabledProvidersRaw(enabled.filter((x) => typeof x === "string").join(", "));
      setDisabledProvidersRaw(disabled.filter((x) => typeof x === "string").join(", "));

      const exists = list.all.some((p) => p.id === providerID);
      if (!exists && list.all[0]) setProviderID(list.all[0].id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load OpenCode provider list");
    } finally {
      setIsLoading(false);
    }
  }, [providerID]);

  const selected = useMemo(() => providers.find((p) => p.id === providerID) ?? null, [providers, providerID]);

  const modelOptions = useMemo(() => {
    const ids = new Set(connected);
    const out: { value: string; label: string }[] = [];
    for (const p of providers) {
      if (!ids.has(p.id)) continue;
      const models = p.models && typeof p.models === "object" ? Object.keys(p.models) : [];
      for (const m of models.sort((a, b) => a.localeCompare(b))) {
        out.push({ value: `${p.id}/${m}`, label: `${p.id}/${m}` });
      }
    }
    return out;
  }, [connected, providers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSetDirectory = useCallback(async () => {
    const current = OpenCodeDirectory.get() ?? "/home/will/opencode-test/warp-site-canvas-main";
    const next = window.prompt("OpenCode directory (absolute path)", current);
    if (next === null) return;
    OpenCodeDirectory.set(next);
    setDirectory(OpenCodeDirectory.get());
    toast.success("Directory updated");
  }, []);

  const handleSaveKey = useCallback(async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("Enter an API key first");
      return;
    }
    setIsLoading(true);
    try {
      await OpenCode.setAuth(providerID, { type: "api", key });
      toast.success(`Saved key for ${providerID}`);
      setApiKey("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, providerID, refresh]);

  const handleSaveProviderConfig = useCallback(async () => {
    const nextBase = baseURL.trim();
    const parseList = (raw: string) =>
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const enabled = parseList(enabledProvidersRaw);
    const disabled = parseList(disabledProvidersRaw);

    setIsLoading(true);
    try {
      await OpenCode.patchConfig({
        model: defaultModel.trim() || undefined,
        small_model: smallModel.trim() || undefined,
        enabled_providers: enabled.length ? (enabled as any) : undefined,
        disabled_providers: disabled.length ? (disabled as any) : undefined,
        provider: {
          [providerID]: {
            options: {
              baseURL: nextBase || undefined,
            },
          },
        } as any,
      });
      toast.success("Saved config to server");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setIsLoading(false);
    }
  }, [baseURL, defaultModel, disabledProvidersRaw, enabledProvidersRaw, providerID, refresh, smallModel]);

  const startOAuth = useCallback(
    async (pid: string, preferLabel?: string) => {
      const list = methods[pid] ?? [];
      const oauth = list
        .map((m, i) => ({ m, i }))
        .filter((x) => x.m.type === "oauth")
        .sort((a, b) => {
          if (!preferLabel) return a.i - b.i;
          const al = a.m.label.toLowerCase();
          const bl = b.m.label.toLowerCase();
          const q = preferLabel.toLowerCase();
          const ap = al.includes(q) ? 0 : 1;
          const bp = bl.includes(q) ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return a.i - b.i;
        })[0];

      if (!oauth) {
        toast.error(`No OAuth login available for ${pid}`);
        return;
      }

      setIsLoading(true);
      try {
        const authorization = await OpenCode.providerOAuthAuthorize(pid, oauth.i);
        if (!authorization) {
          toast.error("This provider did not return an authorization URL");
          return;
        }
        setAuthFlow({ providerID: pid, methodIndex: oauth.i, authorization });
        setAuthCode("");
        setAuthDialogOpen(true);
        window.open(authorization.url, "_blank", "noopener,noreferrer");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start OAuth");
      } finally {
        setIsLoading(false);
      }
    },
    [methods],
  );

  const finishOAuth = useCallback(async () => {
    if (!authFlow) return;
    setIsLoading(true);
    try {
      const code = authFlow.authorization.method === "code" ? authCode.trim() : undefined;
      if (authFlow.authorization.method === "code" && !code) {
        toast.error("Enter the code from the login flow");
        return;
      }
      await OpenCode.providerOAuthCallback(authFlow.providerID, authFlow.methodIndex, code);
      toast.success(`Connected ${authFlow.providerID}`);
      setAuthDialogOpen(false);
      setAuthFlow(null);
      setAuthCode("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OAuth callback failed");
    } finally {
      setIsLoading(false);
    }
  }, [authCode, authFlow, refresh]);

  const handleRemoveKey = useCallback(async () => {
    setIsLoading(true);
    try {
      await OpenCode.removeAuth(providerID);
      toast.success(`Removed key for ${providerID}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove key");
    } finally {
      setIsLoading(false);
    }
  }, [providerID, refresh]);

  const isConnected = connected.includes(providerID);
  const providerMethods = methods[providerID] ?? [];
  const hasOAuth = providerMethods.some((m) => m.type === "oauth");

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-xl flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/builder" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="text-sm font-medium">OpenCode Settings</div>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-4">
        <Card className="p-4">
          <div className="text-sm font-medium">Server</div>
          <div className="mt-2 text-sm text-muted-foreground">
            URL: <span className="font-mono text-foreground">{baseUrl}</span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Directory override: <span className="font-mono text-foreground">{directory ?? "(none)"}</span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Credentials are stored on the server in <span className="font-mono text-foreground">~/.local/share/opencode/auth.json</span>.
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleSetDirectory} disabled={isLoading}>
              Set Directory
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                OpenCodeDirectory.set(null);
                setDirectory(OpenCodeDirectory.get());
                toast.success("Directory override cleared");
              }}
              disabled={isLoading}
            >
              Clear Override
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Workspaces</div>
          <div className="mt-2 text-sm text-muted-foreground">
            When you create a new “workspace session”, we’ll make a new folder under this root and point OpenCode at it.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-xs text-muted-foreground">Workspace root (local)</label>
            <Input
              value={workspaceRoot}
              onChange={(e) => setWorkspaceRoot(e.target.value)}
              placeholder={OpenCodeWorkspace.root.defaultValue}
              disabled={isLoading}
            />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const v = workspaceRoot.trim() || OpenCodeWorkspace.root.defaultValue;
                  OpenCodeWorkspace.root.set(v);
                  setWorkspaceRoot(OpenCodeWorkspace.root.get() ?? OpenCodeWorkspace.root.defaultValue);
                  toast.success("Workspace root saved");
                }}
                disabled={isLoading}
              >
                Save Workspace Root
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  OpenCodeWorkspace.root.set(null);
                  setWorkspaceRoot(OpenCodeWorkspace.root.defaultValue);
                  toast.success("Workspace root reset");
                }}
                disabled={isLoading}
              >
                Reset
              </Button>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <div>
                <div className="text-sm">Auto-create workspace</div>
                <div className="text-xs text-muted-foreground">Automatically create a new workspace when starting a new session.</div>
              </div>
              <Switch
                checked={autoCreateWorkspace}
                onCheckedChange={(v) => {
                  OpenCodeWorkspace.autoCreate.set(!!v);
                  setAutoCreateWorkspace(!!v);
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-1">
              <label className="text-xs text-muted-foreground">Default template</label>
              <select
                value={defaultTemplate}
                onChange={(e) => {
                  const v = e.target.value;
                  OpenCodeWorkspace.defaultTemplate.set(v);
                  setDefaultTemplate(v);
                  toast.success(`Default template set: ${v}`);
                }}
                className="h-10 rounded-md border border-border bg-input px-3 text-sm"
                disabled={isLoading}
              >
                {WORKSPACE_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <div>
                <div className="text-sm">Link shared libraries</div>
                <div className="text-xs text-muted-foreground">Create a shared folder under the workspace root and link it into new workspaces.</div>
              </div>
              <Switch
                checked={linkShared}
                onCheckedChange={(v) => {
                  OpenCodeWorkspace.linkShared.set(!!v);
                  setLinkShared(!!v);
                }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Supabase (Shared)</div>
          <div className="mt-2 text-sm text-muted-foreground">
            One shared local Supabase stack (Docker) for all workspaces. Each workspace can opt into using the shared URL/anon key.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <div>
                <div className="text-sm">Enable Supabase for new workspaces</div>
                <div className="text-xs text-muted-foreground">Writes `SUPABASE_URL` and `SUPABASE_ANON_KEY` into new workspace `.env.local`.</div>
              </div>
              <Switch
                checked={supabaseEnabled}
                onCheckedChange={(v) => {
                  OpenCodeWorkspace.supabase.enabled.set(!!v);
                  setSupabaseEnabled(!!v);
                }}
              />
            </div>

            <div className="text-xs text-muted-foreground">
              Stack dir: <span className="font-mono text-foreground">{supabaseStackDir}</span>
            </div>

            <label className="text-xs text-muted-foreground">Supabase URL</label>
            <Input
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="http://localhost:8000"
              disabled={isLoading}
            />

            <label className="text-xs text-muted-foreground">Anon key</label>
            <Input
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJ..."
              type="password"
              disabled={isLoading}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  OpenCodeWorkspace.supabase.url.set(supabaseUrl.trim() || "http://localhost:8000");
                  OpenCodeWorkspace.supabase.anonKey.set(supabaseAnonKey);
                  toast.success("Saved Supabase settings");
                }}
                disabled={isLoading}
              >
                Save Settings
              </Button>
              <Button variant="secondary" size="sm" onClick={bootstrapSupabase} disabled={isLoading}>
                Bootstrap Stack
              </Button>
              <Button variant="secondary" size="sm" onClick={generateSupabaseKeys} disabled={isLoading}>
                Generate Keys
              </Button>
              <Button variant="secondary" size="sm" onClick={startSupabase} disabled={isLoading}>
                Start Stack
              </Button>
              <Button variant="secondary" size="sm" onClick={supabasePs} disabled={isLoading}>
                Status
              </Button>
              <Button variant="secondary" size="sm" onClick={loadSupabaseKeys} disabled={isLoading}>
                Load Keys From Stack
              </Button>
              <Button variant="glow" size="sm" onClick={writeWorkspaceEnv} disabled={isLoading}>
                Write .env.local To Current Dir
              </Button>
            </div>

            {supabaseStatus ? (
              <pre className="text-xs rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap">
                {supabaseStatus}
              </pre>
            ) : null}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Quick Login</div>
              <div className="mt-1 text-sm text-muted-foreground">OAuth-based providers (same flow as `/connect`).</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={isLoading}
              onClick={() => startOAuth("github-copilot", "copilot")}
            >
              <ExternalLink className="h-4 w-4" />
              Login with GitHub Copilot
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={isLoading}
              onClick={() => startOAuth("openai", "chatgpt")}
            >
              <ExternalLink className="h-4 w-4" />
              Login with ChatGPT
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Builder Defaults</div>
          <div className="mt-2 text-sm text-muted-foreground">
            These are sent with each chat message (agent/model override) so you can match your
            <span className="font-mono"> ~/.config/opencode/opencode.json</span> agent setup even when project configs differ.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-xs text-muted-foreground">Default agent (optional)</label>
            <select
              value={prefAgent ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                OpenCodePreferences.agent.set(v);
                setPrefAgent(v);
                toast.success(v ? `Default agent set: ${v}` : "Default agent cleared");
              }}
              className="h-10 rounded-md border border-border bg-input px-3 text-sm"
              disabled={isLoading}
            >
              <option value="">(none)</option>
              {agentKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            <label className="text-xs text-muted-foreground">Model override (optional)</label>
            <select
              value={prefModel ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                OpenCodePreferences.model.set(v);
                setPrefModel(v);
                toast.success(v ? `Model override set: ${v}` : "Model override cleared");
              }}
              className="h-10 rounded-md border border-border bg-input px-3 text-sm"
              disabled={isLoading}
            >
              <option value="">(none)</option>
              {modelOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Provider Auth</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Store API keys in the OpenCode server (via <span className="font-mono">PUT /auth/:providerID</span>) or use OAuth when available.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-xs text-muted-foreground">Provider</label>
            <select
              value={providerID}
              onChange={(e) => setProviderID(e.target.value)}
              className="h-10 rounded-md border border-border bg-input px-3 text-sm"
              disabled={isLoading}
            >
              {providerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </select>

            <div className="text-xs text-muted-foreground">
              Status: {isConnected ? <Badge variant="secondary">connected</Badge> : <Badge variant="outline">not connected</Badge>}
            </div>

            {selected?.env?.length ? (
              <div className="text-xs text-muted-foreground">
                Env vars: <span className="font-mono text-foreground">{selected.env.join(", ")}</span>
              </div>
            ) : null}

            <div className="text-xs text-muted-foreground">
              Auth methods: {providerMethods.length ? providerMethods.map((m) => m.label).join(", ") : "(none)"}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={isLoading || !hasOAuth}
                onClick={() => startOAuth(providerID)}
                title={hasOAuth ? "" : "No OAuth method exposed by server for this provider"}
              >
                <ExternalLink className="h-4 w-4" />
                OAuth Login
              </Button>
            </div>

            <label className="text-xs text-muted-foreground">API key</label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              type="password"
              disabled={isLoading}
            />

            <div className="flex gap-2">
              <Button variant="glow" size="sm" className="gap-2" onClick={handleSaveKey} disabled={isLoading}>
                <Save className="h-4 w-4" />
                Save To Server
              </Button>
              <Button variant="destructive" size="sm" className="gap-2" onClick={handleRemoveKey} disabled={isLoading}>
                <Trash2 className="h-4 w-4" />
                Remove From Server
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Provider Config</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Writes to the server config (via <span className="font-mono">PATCH /config</span>). Use this for the default model and options like <span className="font-mono">baseURL</span>.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-xs text-muted-foreground">baseURL (optional)</label>
            <Input
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.openai.com/v1"
              disabled={isLoading}
            />

            <label className="text-xs text-muted-foreground">Default model (recommended)</label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="h-10 rounded-md border border-border bg-input px-3 text-sm"
              disabled={isLoading}
            >
              <option value="">(unset - server chooses a default)</option>
              {modelOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <label className="text-xs text-muted-foreground">Small model (optional)</label>
            <select
              value={smallModel}
              onChange={(e) => setSmallModel(e.target.value)}
              className="h-10 rounded-md border border-border bg-input px-3 text-sm"
              disabled={isLoading}
            >
              <option value="">(unset)</option>
              {modelOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <label className="text-xs text-muted-foreground">enabled_providers (comma-separated, optional)</label>
            <Textarea
              value={enabledProvidersRaw}
              onChange={(e) => setEnabledProvidersRaw(e.target.value)}
              placeholder="openai, anthropic"
              disabled={isLoading}
            />

            <label className="text-xs text-muted-foreground">disabled_providers (comma-separated, optional)</label>
            <Textarea
              value={disabledProvidersRaw}
              onChange={(e) => setDisabledProvidersRaw(e.target.value)}
              placeholder="openrouter"
              disabled={isLoading}
            />

            <div className="flex gap-2">
              <Button variant="glow" size="sm" className="gap-2" onClick={handleSaveProviderConfig} disabled={isLoading}>
                <Save className="h-4 w-4" />
                Save Config
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Provider</DialogTitle>
            <DialogDescription>
              {authFlow ? (
                <span>
                  Provider: <span className="font-mono">{authFlow.providerID}</span>
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {authFlow ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Follow the instructions, then finish the connection.</div>

              <Textarea value={authFlow.authorization.instructions} readOnly className="min-h-[140px]" />

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(authFlow.authorization.url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Login Page
                </Button>
              </div>

              {authFlow.authorization.method === "code" ? (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Code</label>
                  <Input value={authCode} onChange={(e) => setAuthCode(e.target.value)} placeholder="Paste code" />
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setAuthDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={finishOAuth} disabled={isLoading || !authFlow} className="gap-2">
              <Save className="h-4 w-4" />
              Finish Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OpenCodeSettings;
