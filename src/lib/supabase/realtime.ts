import type { RealtimeChannel, RealtimeChannelOptions } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Client = ReturnType<typeof createClient>;

/**
 * Subscribes to a Realtime channel as the signed-in user.
 *
 * The browser client loads its session lazily, so a channel joined straight
 * away would authenticate with the public key and RLS would hide the user's
 * own rows. Loading the token first makes postgres_changes (and private
 * channels) see what the user can see.
 *
 * Returns a cleanup function, safe to call before the subscription finishes.
 */
export function subscribeAsUser(
  name: string,
  build: (channel: RealtimeChannel, supabase: Client) => RealtimeChannel,
  options?: {
    config?: RealtimeChannelOptions["config"];
    onStatus?: (status: string, channel: RealtimeChannel) => void;
  },
) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  void (async () => {
    await supabase.realtime.setAuth();
    if (cancelled) return;
    channel = build(supabase.channel(name, { config: options?.config ?? {} }), supabase);
    channel.subscribe((status) => {
      if (channel) options?.onStatus?.(status, channel);
    });
  })();

  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
