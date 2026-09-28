import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

/** Stable hue per person so initials avatars are easy to tell apart. */
function hueFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
}) {
  const hue = hueFor(name ?? "?");
  return (
    <Avatar className={cn("size-10 ring-1 ring-border", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        className="text-[0.8em] font-semibold text-white"
        style={{ background: `linear-gradient(140deg, oklch(0.68 0.13 ${hue}), oklch(0.45 0.1 ${(hue + 40) % 360}))` }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
