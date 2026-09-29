"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Volume2Icon } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isSoundOn, playNotificationSound, setSoundOn, subscribeToSound } from "@/features/notifications/sound";
import { updateEmailPreferences } from "./actions";
import { EMAIL_CATEGORIES, type EmailCategory } from "./email-categories";

/** The chime for new notifications, on or off for this device. */
function SoundSetting() {
  const on = React.useSyncExternalStore(subscribeToSound, isSoundOn, () => true);
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-surface p-3 ring-1 ring-border">
      <label htmlFor="notification-sound" className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium">Sound</span>
        <span className="block text-xs text-muted-foreground">A short chime when a notification arrives. Saved on this device.</span>
      </label>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => playNotificationSound({ force: true })}>
          <Volume2Icon />
          Test
        </Button>
        <Switch id="notification-sound" checked={on} onCheckedChange={setSoundOn} />
      </div>
    </div>
  );
}

/**
 * The notification sound, and which notifications also come by email.
 * Emails only go out for things still unread a minute later while you're
 * away from ReEdit, and several at once arrive as one digest.
 */
export function NotificationsForm({ muted, role }: { muted: string[]; role: "admin" | "editor" }) {
  const router = useRouter();
  const [off, setOff] = React.useState(() => new Set(muted));
  const [pending, startTransition] = React.useTransition();

  const toggle = (category: EmailCategory, on: boolean) => {
    const next = new Set(off);
    if (on) next.delete(category);
    else next.add(category);
    setOff(next);
    startTransition(async () => {
      const result = await updateEmailPreferences([...next]);
      if (!result.ok) {
        setOff(off);
        return void toast.error(result.error);
      }
      toast.success(on ? "Emails turned on" : "Emails turned off");
      router.refresh();
    });
  };

  return (
    <Panel id="notifications" title="Notifications" description="Everything always shows in the bell.">
      <SoundSetting />
      <h3 className="mt-5 text-sm font-medium">Email</h3>
      <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
        Only sent for what&apos;s still unread while you&apos;re away, bundled when there are several.
      </p>
      <ul className="grid grid-cols-1 gap-2">
        {EMAIL_CATEGORIES.filter((c) => (c.roles as readonly string[]).includes(role)).map((category) => {
          const id = `email-${category.value}`;
          return (
            <li key={category.value} className="flex items-center justify-between gap-4 rounded-lg bg-surface p-3 ring-1 ring-border">
              <label htmlFor={id} className="min-w-0 cursor-pointer">
                <span className="block text-sm font-medium">{category.label}</span>
                <span className="block text-xs text-muted-foreground">{role === "admin" ? category.admin : category.editor}</span>
              </label>
              <Switch id={id} checked={!off.has(category.value)} onCheckedChange={(on) => toggle(category.value, on)} disabled={pending} />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
