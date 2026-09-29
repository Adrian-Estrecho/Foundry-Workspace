import { DEFAULT_ACCENT, isHexColor } from "@/lib/theme";

/**
 * ReEdit's email layout: light, with a dark version where the mail app
 * supports it. An editing-suite look, kept quiet: a two-track timeline strip
 * with a playhead in the email's tone, a label like a slate, and the main
 * subject framed by viewfinder corners. Tables and inline styles only, so it
 * holds up in Gmail and Outlook; there are no images, so nothing is blocked.
 * Every value is escaped; a row whose value is a single URL or email address
 * becomes a link.
 */

/** accent = the workspace colour; the rest are fixed status colours. */
export type EmailTone = "accent" | "warning" | "danger" | "success";

export type EmailChip = { label: string; tone?: EmailTone | "neutral" };

export type EmailCard = {
  /** Small caps line above the title, e.g. the client and project. */
  kicker?: string | null;
  title: string;
  text?: string | null;
  chips?: (EmailChip | null | false | undefined)[];
};

export type EmailQuote = { author: string; body: string; meta?: string | null };

export type EmailStep = { label: string; note?: string | null };

export type EmailItem = { label: string; tone?: EmailTone; title: string; text?: string | null; url?: string };

export type EmailContent = {
  heading: string;
  /** Slate label above the heading, e.g. "New task". */
  eyebrow?: string;
  tone?: EmailTone;
  intro?: string | null;
  /** Inbox preview line; defaults to the intro. */
  preheader?: string | null;
  card?: EmailCard;
  quotes?: EmailQuote[];
  rows?: [label: string, value: string | null | undefined][];
  steps?: EmailStep[];
  items?: EmailItem[];
  /** A paragraph after the blocks, before the button. */
  outro?: string | null;
  cta?: { label: string; url: string };
  secondary?: { label: string; url: string };
  signoff?: string | null;
  /** Small print at the bottom of the card: why this email came. */
  footnote?: string | null;
  /** Workspace name shown in the header ("ReEdit" for account emails). */
  brand?: string;
  accent?: string | null;
  /** Adds "Email settings" to the footer. */
  settingsUrl?: string;
  /** For the header's date stamp. */
  timeZone?: string | null;
  /** Replaces the date stamp; null hides it (templates rendered ahead of time). */
  stamp?: string | null;
};

// -----------------------------------------------------------------------------
// Colours
// -----------------------------------------------------------------------------
const INK = "#18181b";
const BODY = "#3f3f46";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const PAGE = "#f4f4f5";
const CARD = "#ffffff";
const BORDER = "#e4e4e7";
const LINE = "#efeff1";
const PANEL = "#fafafa";
const TRACK = "#e4e4e7";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
const mix = (hex: string, other: string, amount: number) => {
  const [a, b] = [toRgb(hex), toRgb(other)];
  return toHex(a.map((c, i) => c + (b[i] - c) * amount) as Rgb);
};

function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

/** The colour darkened just enough for white text on it (and as text on white). */
function readable(hex: string) {
  for (let amount = 0; amount <= 1; amount += 0.05) {
    const candidate = mix(hex, "#000000", amount);
    if (contrastWithWhite(candidate) >= 4.5) return candidate;
  }
  return INK;
}

type Palette = { base: string; ink: string; tint: string };

const STATUS: Record<Exclude<EmailTone, "accent">, Palette> = {
  warning: { base: "#f59e0b", ink: "#b45309", tint: "#fef3c7" },
  danger: { base: "#ef4444", ink: "#b91c1c", tint: "#fee2e2" },
  success: { base: "#22c55e", ink: "#15803d", tint: "#dcfce7" },
};

function palettes(accent: string | null | undefined) {
  const base = isHexColor(accent) ? accent.toLowerCase() : DEFAULT_ACCENT.toLowerCase();
  const brand: Palette = { base, ink: readable(base), tint: mix(base, "#ffffff", 0.88) };
  return { brand, tone: (tone: EmailTone = "accent") => (tone === "accent" ? brand : STATUS[tone]) };
}

// -----------------------------------------------------------------------------
// Pieces
// -----------------------------------------------------------------------------
export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const isUrl = (value: string) => /^https?:\/\/\S+$/.test(value);
const isEmail = (value: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

/** One content row of the card, with the side padding. */
const section = (inner: string, top = 20) =>
  `<tr><td class="px" style="padding:${top}px 36px 0">${inner}</td></tr>`;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "·";
}

function stamp(timeZone: string | null | undefined) {
  const zone = timeZone || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: zone,
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("weekday")} ${get("day")} ${get("month")} · ${get("hour")}:${get("minute")}`.toUpperCase();
  } catch {
    return stamp("UTC");
  }
}

type Clip = "clip" | "soft" | "track" | "gap" | "playhead";

/**
 * Two tracks, V1 (clips in the tone) over A1 (grey audio), with a playhead
 * standing over both. The tracks share columns, so a gap in one can be a
 * clip in the other. Classes let the dark version recolour it.
 */
function timeline(p: Palette) {
  const cols: [width: string, v1: Clip, a1: Clip][] = [
    ["17%", "clip", "track"],
    ["1%", "gap", "track"],
    ["25%", "soft", "track"],
    ["1%", "gap", "gap"],
    ["2", "playhead", "playhead"],
    ["12%", "clip", "track"],
    ["1%", "gap", "track"],
    ["27%", "soft", "track"],
    ["1%", "gap", "gap"],
    ["15%", "clip", "track"],
  ];
  const fill: Record<Clip, [color: string, cls: string]> = {
    clip: [p.base, ""],
    soft: [p.tint, "tl-soft"],
    track: [TRACK, "tl-track"],
    gap: ["", ""],
    playhead: [INK, "tl-head"],
  };
  const cell = (width: string, clip: Clip, height: number) => {
    const [color, cls] = fill[clip];
    return `<td width="${width}"${cls ? ` class="${cls}"` : ""} style="width:${width.endsWith("%") ? width : `${width}px`};height:${height}px;font-size:0;line-height:0;${
      color ? `background:${color};` : ""
    }${clip === "clip" || clip === "soft" ? "border-radius:2px;" : ""}">&nbsp;</td>`;
  };
  const row = (height: number, pick: (col: (typeof cols)[number]) => Clip) =>
    `<tr>${cols.map((col) => cell(col[0], pick(col), height)).join("")}</tr>`;
  const headOnly = (col: (typeof cols)[number]): Clip => (col[1] === "playhead" ? "playhead" : "gap");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row(5, headOnly)}${row(7, (c) => c[1])}${row(
    3,
    headOnly,
  )}${row(5, (c) => c[2])}</table>`;
}

function chip(c: EmailChip, pal: ReturnType<typeof palettes>) {
  const toned = c.tone && c.tone !== "neutral" ? pal.tone(c.tone) : null;
  return `<span class="${toned ? "" : "chip"}" style="display:inline-block;margin:10px 6px 0 0;padding:4px 10px;border-radius:999px;font:500 12px/1.3 ${FONT};${
    toned
      ? `background:${toned.tint};color:${toned.ink};border:1px solid ${toned.tint}`
      : `background:${CARD};color:${BODY};border:1px solid ${BORDER}`
  }">${escapeHtml(c.label)}</span>`;
}

/** The subject, framed by viewfinder corners. */
function card(c: EmailCard, p: Palette, pal: ReturnType<typeof palettes>) {
  const corner = (sides: string) =>
    `<td style="width:14px;height:14px;font-size:0;line-height:0;${sides}">&nbsp;</td>`;
  const edge = `2px solid ${p.base}`;
  const chips = (c.chips ?? []).filter((x): x is EmailChip => Boolean(x));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>${corner(`border-top:${edge};border-left:${edge}`)}<td style="font-size:0;line-height:0">&nbsp;</td>${corner(`border-top:${edge};border-right:${edge}`)}</tr>
<tr><td style="width:14px">&nbsp;</td><td class="panel" style="background:${PANEL};border-radius:8px;padding:16px 18px">
${c.kicker ? `<div class="muted" style="font:600 11px/1.4 ${MONO};letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">${escapeHtml(c.kicker)}</div>` : ""}
<div class="ink" style="${c.kicker ? "padding-top:6px;" : ""}font:600 17px/1.4 ${FONT};color:${INK}">${escapeHtml(c.title)}</div>
${c.text ? `<div class="body" style="padding-top:6px;font:14px/1.6 ${FONT};color:${BODY};white-space:pre-line">${escapeHtml(c.text)}</div>` : ""}
${chips.length ? `<div>${chips.map((x) => chip(x, pal)).join("")}</div>` : ""}
</td><td style="width:14px">&nbsp;</td></tr>
<tr>${corner(`border-bottom:${edge};border-left:${edge}`)}<td style="font-size:0;line-height:0">&nbsp;</td>${corner(`border-bottom:${edge};border-right:${edge}`)}</tr>
</table>`;
}

function quotes(list: EmailQuote[], p: Palette) {
  return list
    .map(
      (q, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${i ? "margin-top:14px" : ""}"><tr>
<td width="34" valign="top" style="width:34px;vertical-align:top"><div style="width:32px;height:32px;border-radius:16px;background:${p.tint};color:${p.ink};font:700 12px/32px ${FONT};text-align:center">${escapeHtml(initials(q.author))}</div></td>
<td style="padding-left:12px;vertical-align:top">
<div class="ink" style="font:600 13px/1.4 ${FONT};color:${INK}">${escapeHtml(q.author)}${q.meta ? `<span class="muted" style="font:500 11px ${MONO};color:${FAINT}">&nbsp;&nbsp;${escapeHtml(q.meta)}</span>` : ""}</div>
<div class="panel body" style="margin-top:6px;background:${PANEL};border-radius:4px 12px 12px 12px;padding:12px 14px;font:15px/1.6 ${FONT};color:${BODY};white-space:pre-line">${escapeHtml(q.body)}</div>
</td></tr></table>`,
    )
    .join("");
}

function rows(list: [string, string][], p: Palette) {
  const value = (v: string) =>
    isUrl(v)
      ? `<a href="${escapeHtml(v)}" style="color:${p.ink};word-break:break-all">${escapeHtml(v)}</a>`
      : isEmail(v)
        ? `<a href="mailto:${escapeHtml(v)}" style="color:${p.ink}">${escapeHtml(v)}</a>`
        : escapeHtml(v);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list
    .map(
      ([label, v]) =>
        `<tr><td class="line muted" style="width:34%;padding:10px 12px 10px 0;border-top:1px solid ${LINE};vertical-align:top;font:600 11px/1.6 ${MONO};letter-spacing:.06em;text-transform:uppercase;color:${MUTED}">${escapeHtml(label)}</td><td class="line ink" style="padding:10px 0;border-top:1px solid ${LINE};font:14px/1.55 ${FONT};color:${INK};white-space:pre-line">${value(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

/** Numbered steps drawn as clips on a track. */
function steps(list: EmailStep[], p: Palette) {
  return list
    .map(
      (s, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${i ? "margin-top:6px" : ""}"><tr>
<td width="34" class="muted" style="width:34px;font:600 11px/1 ${MONO};color:${FAINT};vertical-align:middle">${String(i + 1).padStart(2, "0")}</td>
<td class="panel" style="background:${PANEL};border-left:3px solid ${p.base};border-radius:3px 8px 8px 3px;padding:10px 14px">
<div class="ink" style="font:600 14px/1.4 ${FONT};color:${INK}">${escapeHtml(s.label)}</div>
${s.note ? `<div class="body" style="padding-top:2px;font:13px/1.5 ${FONT};color:${BODY}">${escapeHtml(s.note)}</div>` : ""}
</td></tr></table>`,
    )
    .join("");
}

function items(list: EmailItem[], pal: ReturnType<typeof palettes>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list
    .map((item) => {
      const t = pal.tone(item.tone);
      const title = item.url
        ? `<a href="${escapeHtml(item.url)}" class="ink" style="color:${INK};text-decoration:none">${escapeHtml(item.title)}</a>`
        : escapeHtml(item.title);
      return `<tr><td class="line" style="padding:14px 0;border-top:1px solid ${LINE}">
<div class="t-${item.tone ?? "accent"}" style="font:600 10.5px/1.4 ${MONO};letter-spacing:.1em;text-transform:uppercase;color:${t.ink}"><span style="color:${t.base}">&#9679;</span>&nbsp; ${escapeHtml(item.label)}</div>
<div class="ink" style="padding-top:4px;font:600 15px/1.45 ${FONT};color:${INK}">${title}</div>
${item.text ? `<div class="body" style="padding-top:2px;font:13.5px/1.55 ${FONT};color:${BODY};white-space:pre-line">${escapeHtml(item.text)}</div>` : ""}
</td></tr>`;
    })
    .join("")}</table>`;
}

/** The dark version, for mail apps that support prefers-color-scheme. */
const darkCss = (p: Palette, pal: ReturnType<typeof palettes>) => `
.bg{background:#0c0c0e!important}
.card{background:#161618!important;border-color:#27272a!important}
.ink{color:#fafafa!important}
.body{color:#d4d4d8!important}
.muted{color:#a1a1aa!important}
.panel{background:#1f1f23!important}
.line{border-color:#27272a!important}
.chip{background:#1f1f23!important;border-color:#3f3f46!important;color:#e4e4e7!important}
.tl-soft{background:${mix(p.base, "#161618", 0.62)}!important}
.tl-track{background:#2e2e33!important}
.tl-head{background:#fafafa!important}
${(["accent", "warning", "danger", "success"] as const).map((t) => `.t-${t}{color:${pal.tone(t).base}!important}`).join("")}`;

// -----------------------------------------------------------------------------
// The email
// -----------------------------------------------------------------------------
export function renderEmail(content: EmailContent) {
  const pal = palettes(content.accent);
  const p = pal.tone(content.tone);
  const brand = content.brand ?? "ReEdit";
  const visibleRows = (content.rows ?? []).filter((r): r is [string, string] => Boolean(r[1]));
  const preheader = content.preheader ?? content.intro ?? "";

  const blocks = [
    content.card && section(card(content.card, p, pal), 22),
    content.quotes?.length && section(quotes(content.quotes, p), 22),
    visibleRows.length && section(rows(visibleRows, p), 20),
    content.steps?.length && section(steps(content.steps, p), 20),
    content.items?.length && section(items(content.items, pal), 16),
    content.outro &&
      section(`<div class="body" style="font:15px/1.65 ${FONT};color:${BODY}">${escapeHtml(content.outro)}</div>`, 20),
    content.cta &&
      section(
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-radius:10px;background:${pal.brand.ink}"><a href="${escapeHtml(content.cta.url)}" style="display:inline-block;padding:13px 22px;border-radius:10px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none">${escapeHtml(content.cta.label)}&nbsp;&nbsp;&rarr;</a></td>
${content.secondary ? `<td style="padding-left:18px"><a href="${escapeHtml(content.secondary.url)}" class="muted" style="font:500 14px/1.4 ${FONT};color:${MUTED};text-decoration:underline">${escapeHtml(content.secondary.label)}</a></td>` : ""}
</tr></table>`,
        28,
      ),
    content.signoff &&
      section(
        `<div class="body" style="font:15px/1.6 ${FONT};color:${BODY};white-space:pre-line">${escapeHtml(content.signoff)}</div>`,
        24,
      ),
    content.footnote &&
      section(
        `<div class="line muted" style="border-top:1px solid ${LINE};padding-top:18px;font:12.5px/1.6 ${FONT};color:${MUTED}">${escapeHtml(content.footnote)}</div>`,
        28,
      ),
  ].filter(Boolean);

  const wordmark = `<span style="display:inline-block;padding:0 3px;border:1px solid ${pal.brand.base};border-radius:3px;background:${pal.brand.tint};color:${pal.brand.ink}">Re</span>Edit`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(content.heading)}</title>
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
@media (max-width:600px){.px{padding-left:22px!important;padding-right:22px!important}.hide-sm{display:none!important}}
@media (prefers-color-scheme:dark){${darkCss(p, pal)}}
[data-ogsc] .card{background:#161618!important}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${PAGE}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:${PAGE}"><tr><td align="center" style="padding:32px 12px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
<tr><td style="padding:0 6px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${
  brand === "ReEdit"
    ? `<td class="ink" style="font:700 17px/1.2 ${FONT};letter-spacing:-.01em;color:${INK}"><span style="display:inline-block;padding:0 4px;margin-right:1px;border:1.5px solid ${pal.brand.base};border-radius:4px;background:${pal.brand.tint};color:${pal.brand.ink}">Re</span>Edit</td>`
    : `<td class="ink" style="font:600 14px/1.2 ${FONT};color:${INK}"><span style="display:inline-block;padding:3px 7px;margin-right:9px;border:1.5px solid ${pal.brand.base};border-radius:5px;background:${pal.brand.tint};font:700 11px/1.2 ${MONO};letter-spacing:.04em;color:${pal.brand.ink};vertical-align:1px">${escapeHtml(initials(brand))}</span>${escapeHtml(brand)}</td>`
}
<td align="right" class="hide-sm" style="font:500 11px/1.2 ${MONO};letter-spacing:.08em;color:${FAINT};white-space:nowrap">${content.stamp === null ? "" : escapeHtml(content.stamp ?? stamp(content.timeZone))}</td>
</tr></table>
</td></tr>
<tr><td class="card" style="background:${CARD};border:1px solid ${BORDER};border-radius:16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${section(timeline(p), 28)}
${content.eyebrow ? section(`<div class="t-${content.tone ?? "accent"}" style="font:600 11px/1.4 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:${p.ink}"><span style="color:${p.base}">&#9679;</span>&nbsp; ${escapeHtml(content.eyebrow)}</div>`, 24) : ""}
${section(`<h1 class="ink" style="margin:0;font:700 24px/1.3 ${FONT};letter-spacing:-.01em;color:${INK}">${escapeHtml(content.heading)}</h1>`, content.eyebrow ? 10 : 24)}
${content.intro ? section(`<div class="body" style="font:15px/1.65 ${FONT};color:${BODY}">${escapeHtml(content.intro)}</div>`, 10) : ""}
${blocks.join("\n")}
<tr><td style="height:34px;font-size:0;line-height:0">&nbsp;</td></tr>
</table>
</td></tr>
<tr><td align="center" class="muted" style="padding:22px 12px 0;font:12px/1.7 ${FONT};color:${FAINT}">
Sent with ${wordmark}${brand === "ReEdit" ? "" : ` for ${escapeHtml(brand)}`}${
    content.settingsUrl
      ? ` &nbsp;·&nbsp; <a href="${escapeHtml(content.settingsUrl)}" style="color:${FAINT};text-decoration:underline">Email settings</a>`
      : ""
  }
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;

  const text = [
    content.eyebrow?.toUpperCase(),
    content.heading,
    content.intro,
    content.card &&
      [
        content.card.kicker,
        content.card.title,
        content.card.text,
        (content.card.chips ?? []).filter((x): x is EmailChip => Boolean(x)).map((x) => x.label).join(" · "),
      ]
        .filter(Boolean)
        .join("\n"),
    ...(content.quotes ?? []).map((q) => `${q.author}${q.meta ? ` (${q.meta})` : ""}:\n${q.body}`),
    visibleRows.map(([label, value]) => `${label}: ${value}`).join("\n"),
    (content.steps ?? []).map((s, i) => `${i + 1}. ${s.label}${s.note ? ` — ${s.note}` : ""}`).join("\n"),
    ...(content.items ?? []).map((item) =>
      [`[${item.label}] ${item.title}`, item.text, item.url].filter(Boolean).join("\n"),
    ),
    content.outro,
    content.cta && `${content.cta.label}: ${content.cta.url}`,
    content.secondary && `${content.secondary.label}: ${content.secondary.url}`,
    content.signoff,
    content.footnote,
    content.settingsUrl && `Email settings: ${content.settingsUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { html, text };
}
