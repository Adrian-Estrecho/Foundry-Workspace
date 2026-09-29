"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, MegaphoneIcon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncement, updateAnnouncement } from "../actions";

/** Post (or edit) an announcement. Everyone in the workspace is notified of new ones. */
export function AnnouncementDialog({
  open,
  onOpenChange,
  announcement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: { id: string; title: string; body: string; isPinned: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const editing = Boolean(announcement);

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = announcement ? await updateAnnouncement(announcement.id, formData) : await createAnnouncement(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success(editing ? "Announcement saved" : "Announcement posted", {
        description: editing ? undefined : "Everyone on the team has been notified.",
      });
      setErrors({});
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>
            {editing ? "Changes show for everyone straight away." : "Goes to everyone on the team, in the app and by email."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitWith(submit)} className="grid gap-4">
          <FormRow label="Title" required error={errors.title}>
            <Input name="title" required maxLength={140} defaultValue={announcement?.title} autoFocus aria-invalid={!!errors.title} />
          </FormRow>
          <FormRow label="Message" required error={errors.body} hint="Links become clickable.">
            <Textarea
              name="body"
              required
              rows={6}
              maxLength={8000}
              defaultValue={announcement?.body}
              className="max-h-[50vh]"
              aria-invalid={!!errors.body}
            />
          </FormRow>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox name="is_pinned" defaultChecked={announcement?.isPinned} className="mt-0.5" />
            <span>
              <span className="font-medium">Pin to the top</span>
              <span className="block text-muted-foreground">For things people should keep coming back to.</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <MegaphoneIcon />}
              {editing ? "Save" : "Post announcement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
