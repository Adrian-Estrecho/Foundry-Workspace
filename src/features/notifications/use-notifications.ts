"use client";

import * as React from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { subscribeAsUser } from "@/lib/supabase/realtime";
import type { Tables } from "@/types/database";
import { NOTIFICATION_PAGE_SIZE } from "./constants";

export type Notification = Tables<"notifications">;
export type NotificationFilter = "all" | "unread";

/**
 * How far down a filter's list is loaded without gaps. Everything newer than
 * `cursor` is known; `done` means there's nothing older left to fetch.
 */
type Feed = { cursor: Notification | null; done: boolean; loading: boolean; failed: boolean };

type State = {
  byId: Record<string, Notification>;
  /** Unread rows in the database, including ones not loaded yet. */
  unread: number;
  feeds: Record<NotificationFilter, Feed>;
};

type Action =
  | { type: "sync"; rows: Notification[]; unread: number }
  | { type: "insert"; row: Notification }
  | { type: "update"; row: Notification }
  | { type: "read"; ids: string[]; at: string }
  | { type: "readAll"; at: string }
  | { type: "loading" | "failed"; filter: NotificationFilter }
  | { type: "page"; filter: NotificationFilter; rows: Notification[] };

/** Same order as the queries: created_at desc, then id desc. */
export function newestFirst(a: Notification, b: Notification) {
  return Date.parse(b.created_at) - Date.parse(a.created_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

// A fetched copy can be older than a local "mark read", so never flip a row back to unread.
function upsert(byId: State["byId"], rows: Notification[]) {
  const next = { ...byId };
  for (const row of rows) {
    const known = next[row.id];
    next[row.id] = known?.read_at && !row.read_at ? { ...row, read_at: known.read_at } : row;
  }
  return next;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "sync":
      return { ...state, byId: upsert(state.byId, action.rows), unread: action.unread };
    case "insert": {
      if (state.byId[action.row.id]) return state;
      return {
        ...state,
        byId: { ...state.byId, [action.row.id]: action.row },
        unread: state.unread + (action.row.read_at ? 0 : 1),
      };
    }
    case "update": {
      // A message notification refreshed by a newer message comes back
      // unread and to the top; anything else just takes the new values.
      const known = state.byId[action.row.id];
      if (!known) return reducer(state, { type: "insert", row: action.row });
      const unreadChange = Number(!action.row.read_at) - Number(!known.read_at);
      return { ...state, byId: { ...state.byId, [action.row.id]: action.row }, unread: Math.max(0, state.unread + unreadChange) };
    }
    case "read": {
      const byId = { ...state.byId };
      let changed = 0;
      for (const id of action.ids) {
        const row = byId[id];
        if (row && !row.read_at) {
          byId[id] = { ...row, read_at: action.at };
          changed += 1;
        }
      }
      return changed ? { ...state, byId, unread: Math.max(0, state.unread - changed) } : state;
    }
    case "readAll": {
      const byId = Object.fromEntries(
        Object.entries(state.byId).map(([id, row]) => [id, row.read_at ? row : { ...row, read_at: action.at }]),
      );
      return { ...state, byId, unread: 0 };
    }
    case "loading":
    case "failed": {
      const feed = { ...state.feeds[action.filter], loading: action.type === "loading", failed: action.type === "failed" };
      return { ...state, feeds: { ...state.feeds, [action.filter]: feed } };
    }
    case "page": {
      const feed: Feed = {
        cursor: action.rows.at(-1) ?? state.feeds[action.filter].cursor,
        done: action.rows.length < NOTIFICATION_PAGE_SIZE,
        loading: false,
        failed: false,
      };
      return { ...state, byId: upsert(state.byId, action.rows), feeds: { ...state.feeds, [action.filter]: feed } };
    }
  }
}

function init({ rows, unread }: { rows: Notification[]; unread: number }): State {
  const sorted = [...rows].sort(newestFirst);
  return {
    byId: upsert({}, sorted),
    unread,
    feeds: {
      // The layout loads the newest page, so "all" starts out gap-free down to its last row.
      all: { cursor: sorted.at(-1) ?? null, done: rows.length < NOTIFICATION_PAGE_SIZE, loading: false, failed: false },
      unread: { cursor: null, done: false, loading: false, failed: false },
    },
  };
}

/**
 * Where a filter's list is complete down to. Everything above the "all"
 * cursor is loaded, read or not, so the unread list can use whichever of the
 * two cursors reaches further back.
 */
function coverage(feeds: State["feeds"], filter: NotificationFilter) {
  const { all, unread } = feeds;
  if (filter === "all" || all.done) return all;
  if (unread.done || !all.cursor) return unread;
  if (!unread.cursor) return all;
  return newestFirst(all.cursor, unread.cursor) > 0 ? all : unread;
}

const newestPage = (userId: string) =>
  createClient()
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NOTIFICATION_PAGE_SIZE);

/**
 * The signed-in user's notifications, shared by the bell and the full list.
 * New rows arrive live over Realtime (RLS limits the stream to the user's own
 * rows) and pop a toast. Older rows load a page at a time.
 */
export function useNotifications(userId: string, initial: Notification[], initialUnread: number) {
  const [state, dispatch] = React.useReducer(reducer, { rows: initial, unread: initialUnread }, init);

  // A router.refresh() re-renders the layout with fresh rows and counts.
  const [synced, setSynced] = React.useState({ initial, initialUnread });
  if (synced.initial !== initial || synced.initialUnread !== initialUnread) {
    setSynced({ initial, initialUnread });
    dispatch({ type: "sync", rows: initial, unread: initialUnread });
  }

  React.useEffect(
    () =>
      subscribeAsUser(
        `notifications:${userId}`,
        (channel) =>
          channel.on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
            (payload) => {
              const row = payload.new as Notification;
              dispatch({ type: "insert", row });
              toast(row.title, { description: row.body ?? undefined });
            },
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
            (payload) => {
              const row = payload.new as Notification;
              dispatch({ type: "update", row });
              // Surfaced again just now by something new (a message in the same thread).
              if (!row.read_at && Date.now() - Date.parse(row.created_at) < 30_000) {
                toast(row.title, { description: row.body ?? undefined });
              }
            },
          ),
        {
          // Catch anything created between page render and the subscription going live.
          onStatus: async (status) => {
            if (status !== "SUBSCRIBED") return;
            const [rows, unread] = await Promise.all([
              newestPage(userId),
              createClient()
                .from("notifications")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .is("read_at", null),
            ]);
            if (rows.data && unread.count !== null) dispatch({ type: "sync", rows: rows.data, unread: unread.count });
          },
        },
      ),
    [userId],
  );

  const sorted = React.useMemo(() => Object.values(state.byId).sort(newestFirst), [state.byId]);
  const loadedUnread = sorted.filter((n) => !n.read_at);
  // Once every row is loaded they are the truth. Until then, never show fewer
  // unread than are on screen, even if the count is a beat behind.
  const unread = state.feeds.all.done ? loadedUnread.length : Math.max(state.unread, loadedUnread.length);

  /** The gap-free part of a filter's list, and whether older rows remain. */
  const view = (filter: NotificationFilter) => {
    const { cursor, done } = coverage(state.feeds, filter);
    const rows = filter === "unread" ? loadedUnread : sorted;
    const complete = done || (filter === "unread" && rows.length >= unread);
    const { loading, failed } = state.feeds[filter];
    if (complete) return { rows, hasMore: false, loading, failed };
    return { rows: cursor ? rows.filter((n) => newestFirst(n, cursor) <= 0) : [], hasMore: true, loading, failed };
  };

  const loadMore = async (filter: NotificationFilter) => {
    if (state.feeds[filter].loading) return;
    const { cursor } = coverage(state.feeds, filter);
    dispatch({ type: "loading", filter });

    let query = newestPage(userId);
    if (filter === "unread") query = query.is("read_at", null);
    if (cursor) {
      // Keyset paging; the id breaks ties between rows created in the same instant.
      const at = `"${cursor.created_at}"`;
      query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${cursor.id})`);
    }
    const { data, error } = await query;
    dispatch(error ? { type: "failed", filter } : { type: "page", filter, rows: data });
  };

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const at = new Date().toISOString();
    dispatch({ type: "read", ids, at });
    const { error } = await createClient().from("notifications").update({ read_at: at }).in("id", ids);
    if (error) toast.error("Couldn't mark that as read. Try again.");
  };

  const markAllRead = async () => {
    const at = new Date().toISOString();
    dispatch({ type: "readAll", at });
    const { error } = await createClient()
      .from("notifications")
      .update({ read_at: at })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) toast.error("Couldn't mark everything as read. Try again.");
  };

  return { unread, view, loadMore, markRead, markAllRead };
}

export type NotificationsStore = ReturnType<typeof useNotifications>;
