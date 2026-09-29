"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Switch } from "@/components/ui/switch";
import { updateEmailPreferences } from "./actions";
import { EMAIL_CATEGORIES, type EmailCategory } from "./email-categories";

/**
 * Which notifications also come by email. Emails only go out for things
 * still unread a minute later while you're away from ReEdit, and several at
 * once arrive as one digest.
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
    <Panel
      id="notifications"
      title="Email notifications"
      description="Everything always shows in the bell. Emails are only sent for what's still unread while you're away, bundled when there are several."
    >
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
