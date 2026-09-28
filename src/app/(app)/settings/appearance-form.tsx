"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRightIcon, Loader2Icon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { AccentPicker } from "@/components/theme/accent-picker";
import { useTheme } from "@/components/theme/theme-provider";
import { Panel } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { StatusChip } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { applyBrandTokens, clearBrandTokens, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { updateAppearance } from "./actions";

type Props = {
  savedAccent: string | null; // null = company default
  savedTint: boolean;
  companyAccent: string;
};

export function AppearanceForm({ savedAccent, savedTint, companyAccent }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [useCompany, setUseCompany] = React.useState(savedAccent === null);
  const [accent, setAccent] = React.useState(savedAccent ?? companyAccent);
  const [tint, setTint] = React.useState(savedTint);
  const [pending, startTransition] = React.useTransition();

  const effective = useCompany ? companyAccent : accent;
  const dirty = (useCompany ? null : accent.toUpperCase()) !== (savedAccent?.toUpperCase() ?? null) || tint !== savedTint;

  // Live preview across the whole app while choosing.
  React.useEffect(() => {
    applyBrandTokens(effective, tint);
  }, [effective, tint]);
  // Leaving the page drops any unsaved preview.
  React.useEffect(() => clearBrandTokens, []);

  const save = () =>
    startTransition(async () => {
      const result = await updateAppearance({ accent: useCompany ? null : accent, tint });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <Panel id="appearance" title="Appearance" description="Only you see these choices. They follow you to any device.">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-7">
          <div className="grid gap-3">
            <Label>Mode</Label>
            <Segmented<ThemeMode>
              label="Colour mode"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
                { value: "system", label: "System" },
              ]}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {theme === "dark" ? <MoonIcon className="size-3.5" /> : theme === "light" ? <SunIcon className="size-3.5" /> : <MonitorIcon className="size-3.5" />}
              Saved on this device.
            </p>
          </div>

          <div className="grid gap-3">
            <Label>Accent colour</Label>
            <Segmented
              label="Accent source"
              value={useCompany ? "company" : "custom"}
              onChange={(value) => setUseCompany(value === "company")}
              options={[
                { value: "company", label: "Company default" },
                { value: "custom", label: "My own colour" },
              ]}
            />
            {useCompany ? (
              <p className="text-sm text-muted-foreground">
                Following the company colour{" "}
                <span className="inline-block size-3 translate-y-0.5 rounded-full" style={{ background: companyAccent }} />{" "}
                <span className="font-mono">{companyAccent}</span>.
              </p>
            ) : (
              <AccentPicker value={accent} onChange={setAccent} />
            )}
          </div>

          <div className="flex items-start justify-between gap-6 rounded-lg bg-surface p-4 ring-1 ring-border">
            <div>
              <Label htmlFor="tint">Tint the background</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Give the greys a faint hint of your accent instead of staying neutral.
              </p>
            </div>
            <Switch id="tint" checked={tint} onCheckedChange={setTint} />
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={!dirty || pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Save appearance
            </Button>
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setUseCompany(savedAccent === null);
                  setAccent(savedAccent ?? companyAccent);
                  setTint(savedTint);
                }}
              >
                Discard
              </Button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="grid content-start gap-3 rounded-xl bg-background p-4 ring-1 ring-border">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Preview</p>
          <div className="rounded-lg border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="size-2 rounded-full bg-primary" /> Active item
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Links, focus rings and highlights use the accent.</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Team hours</span>
              <span className="text-sm font-medium text-success">↑ 2.9%</span>
            </div>
            <div className="mt-3 flex h-16 items-end gap-1.5">
              {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
                <span key={i} className={cn("flex-1 rounded-sm", i === 5 ? "bg-primary" : "bg-muted")} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm">
              <ArrowUpRightIcon /> Primary
            </Button>
            <Button size="sm" variant="secondary">
              Secondary
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip status="working" />
            <StatusChip status="on_break" />
            <StatusChip status="offline" />
          </div>
          <p className="text-xs text-muted-foreground">Status colours stay the same whatever accent you pick.</p>
        </div>
      </div>
    </Panel>
  );
}
