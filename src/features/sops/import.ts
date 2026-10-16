import type { CalloutVariant } from "./blocks";

/**
 * Brings a document written somewhere else (a Word file, a Google Doc, a
 * paste) into an SOP, laid out with the SOP's own blocks. It rewrites the
 * HTML, which the editor then reads into its nodes. Browser only: it uses
 * DOMParser.
 *
 * What it does to the document:
 * - The first heading becomes the SOP's title when it stands above the rest.
 * - Headings become sections and subsections. A short bold line with text
 *   under it becomes a heading too.
 * - Numbered lists and "Step 1: …" or "1. …" lines become a step by step. A
 *   numbered list broken by a note or a picture carries on.
 * - Lines starting "Note:", "Tip:", "Warning:", "Do:", "Don't:" (or ⚠️ 💡 ✅ ❌),
 *   and one-cell tables, become callout boxes.
 * - ☐ and [ ] items, Word checkboxes, and lists under a "Checklist" or
 *   "Before you start" heading become checklists.
 * - A table's first row becomes its header when it's all bold.
 * - Pictures, a table of contents (the SOP makes its own), empty lines and
 *   styling the SOP doesn't use are dropped.
 */

export type ImportCounts = { sections: number; steps: number; checklists: number; callouts: number; tables: number; images: number };
export type ImportResult = { html: string; title: string | null; counts: ImportCounts };

/** A Word file (.docx) as HTML. Google Docs saves one with File → Download → Microsoft Word. */
export async function readDocx(file: File) {
  const { default: mammoth } = await import("mammoth");
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      styleMap: [
        "p[style-name='Title'] => h1.sop-title:fresh",
        "p[style-name='Quote'] => blockquote > p:fresh",
        "p[style-name='Intense Quote'] => blockquote > p:fresh",
        "p[style-name='Code'] => pre:separator('\\n')",
        "u => u",
      ],
      // Pictures aren't kept, so don't read them.
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
    },
  );
  return result.value;
}

const SHOW_TEXT = 4; // NodeFilter.SHOW_TEXT
const SHOW_COMMENT = 128; // NodeFilter.SHOW_COMMENT

const BLOCKS = "p, h1, h2, h3, h4, h5, h6, ul, ol, li, table, blockquote, pre, aside, hr, div, section, article";

/** Same length as the text, so matches line up with it: odd spaces are spaces, curly apostrophes straight. */
const normal = (value: string) => value.replace(/[ ​﻿]/g, " ").replace(/[‘’]/g, "'");
const textOf = (el: Element) => normal(el.textContent ?? "").replace(/\s+/g, " ").trim();

const isHeading = (el: Element | null): el is HTMLElement => !!el && /^H[1-6]$/.test(el.tagName);
const levelOf = (el: Element) => Number(el.tagName[1]);
const isTag = (el: Element | null, ...tags: string[]) => !!el && tags.includes(el.tagName);
const safeHref = (href: string | null) => !!href && /^(https?:|mailto:)/i.test(href.trim());

function make(doc: Document, tag: string, attrs: Record<string, string> = {}) {
  const el = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/** Swaps an element for a new one with the same children. */
function rename(el: Element, tag: string, attrs: Record<string, string> = {}) {
  const next = make(el.ownerDocument, tag, attrs);
  next.append(...Array.from(el.childNodes));
  el.replaceWith(next);
  return next;
}

const unwrap = (el: Element) => el.replaceWith(...Array.from(el.childNodes));

function textNodes(el: Element) {
  const walker = el.ownerDocument.createTreeWalker(el, SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  return nodes;
}

/** Whether every bit of text passes the test (and there is some). */
function everyText(el: Element, test: (node: Text) => boolean) {
  const nodes = textNodes(el).filter((node) => normal(node.data).trim());
  return nodes.length > 0 && nodes.every(test);
}

const allBold = (el: Element) => everyText(el, (node) => !!node.parentElement?.closest("strong"));

/** Line breaks and spaces at either end of a block. */
function trimEdges(el: Element) {
  for (const edge of ["firstChild", "lastChild"] as const) {
    for (let node = el[edge]; node; node = el[edge]) {
      const blank = node.nodeType === 3 ? !normal(node.textContent ?? "").trim() : node.nodeName === "BR";
      if (!blank) break;
      node.remove();
    }
  }
}

/** Removes the first `count` characters of an element's text, and any formatting left empty. */
function dropLeading(el: Element, count: number) {
  for (const node of textNodes(el)) {
    if (count <= 0) break;
    const cut = Math.min(count, node.data.length);
    node.data = node.data.slice(cut);
    count -= cut;
  }
  for (const inline of Array.from(el.querySelectorAll("strong, em, u, s, code, a")).reverse()) {
    if (!inline.textContent) inline.remove();
  }
  trimEdges(el);
}

function dropTrailingColon(el: Element) {
  const last = textNodes(el).findLast((node) => node.data.trim());
  if (last) last.data = last.data.replace(/\s*:\s*$/, "");
}

/* ---- What a line says it is ------------------------------------------------ */

const CALLOUT_WORDS: Record<CalloutVariant, string[]> = {
  note: ["note", "notes", "nb", "n.b.", "fyi", "remember", "reminder"],
  tip: ["tip", "tips", "pro tip", "pro tips", "hint", "shortcut"],
  guideline: ["guideline", "guidelines", "rule", "rules", "standard", "standards", "policy", "best practice", "best practices"],
  important: ["important", "key point", "key points", "critical", "essential", "mandatory"],
  warning: ["warning", "warnings", "caution", "careful", "be careful", "danger", "attention", "heads up", "heads-up", "watch out"],
  do: ["do", "dos", "do's", "always"],
  dont: ["don't", "dont", "do not", "don'ts", "donts", "dont's", "avoid", "never", "common mistakes", "mistakes to avoid"],
};

const CALLOUT_EMOJI: [string, CalloutVariant][] = [
  ["⚠", "warning"],
  ["🛑", "warning"],
  ["💡", "tip"],
  ["ℹ", "note"],
  ["📝", "note"],
  ["📌", "important"],
  ["❗", "important"],
  ["‼", "important"],
  ["⭐", "important"],
  ["✅", "do"],
  ["👍", "do"],
  ["❌", "dont"],
  ["🚫", "dont"],
  ["⛔", "dont"],
  ["👎", "dont"],
];

const WORD_VARIANT = new Map(
  Object.entries(CALLOUT_WORDS).flatMap(([variant, words]) => words.map((word) => [word, variant as CalloutVariant] as const)),
);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A label, then a colon, a spaced dash, or nothing more. */
const LABEL = new RegExp(
  `^\\s*(${[...WORD_VARIANT.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")})(?:\\s*:\\s*|\\s+[-–—]\\s+|\\s*$)`,
  "i",
);

type Prefix = { variant: CalloutVariant; length: number; rest: boolean; emoji: boolean };

/** "Note: …", "⚠️ …" and the like: which box, and how much of the text is the label. */
function calloutPrefix(el: Element): Prefix | null {
  const text = normal(el.textContent ?? "");
  let at = text.length - text.trimStart().length;
  let variant: CalloutVariant | undefined;
  const emoji = CALLOUT_EMOJI.find(([mark]) => text.startsWith(mark, at));
  if (emoji) {
    variant = emoji[1];
    at += emoji[0].length;
    if (text[at] === "️") at++;
  }
  const label = LABEL.exec(text.slice(at));
  if (label) {
    variant = WORD_VARIANT.get(label[1].toLowerCase()) ?? variant;
    at += label[0].length;
  } else if (variant) {
    at += /^\s*(?:[:\-–—]\s*)?/.exec(text.slice(at))![0].length;
  }
  if (!variant) return null;
  return { variant, length: at, rest: !!text.slice(at).trim(), emoji: !!emoji };
}

const STEP = /^\s*step\s*(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\b\s*(?:[:.)\-–—]\s*)?/i;
const NUMBERED = /^\s*\(?(\d{1,2})[.)]\s+(?=\S)/;
const stepPrefix = (el: Element) => (isTag(el, "P", "LI") || isHeading(el) ? (STEP.exec(normal(el.textContent ?? ""))?.[0].length ?? 0) : 0);

/** ☐ / ☑ / [ ] / [x] at the start of a line (✅ and ✓ too, inside lists). */
const BOX = /^\s*(?:\[(\s?|[xX✓✔])\]|([☐□▢◻⬜])|([☑☒]))\s*/;
const LIST_TICK = /^\s*([✓✔✅])\s*/;

type Check = { checked: boolean; input?: Element; length: number };

function checkOf(item: Element, inList: boolean): Check | null {
  const input = item.querySelector('input[type="checkbox"]');
  if (input && (item.tagName !== "LI" || input.closest("li") === item)) return { checked: input.hasAttribute("checked"), input, length: 0 };
  const text = normal(item.textContent ?? "");
  const box = BOX.exec(text);
  if (box) return { checked: !!box[1]?.trim() || !!box[3], length: box[0].length };
  const tick = inList ? LIST_TICK.exec(text) : null;
  return tick ? { checked: true, length: tick[0].length } : null;
}

function clearCheck(item: Element, check: Check) {
  check.input?.remove();
  if (check.length) dropLeading(item, check.length);
}

const CHECKLIST_HEADING =
  /\b(check ?list|checks|before you (start|begin)|pre-?flight|requirements|prerequisites|what you('ll)? need|you('ll| will) need|qc|quality check)\b/i;
const CONTENTS_HEADING = /^(table of )?contents:?$/i;

/* ---- Cleaning up ----------------------------------------------------------- */

/** Word's own lists in pasted HTML are paragraphs with an mso-list style; make them lists. */
function wordLists(root: HTMLElement) {
  const doc = root.ownerDocument;
  const LEVEL = /mso-list:\s*l\d+\s+level(\d+)/i;
  const levelOfItem = (el: Element | null) => (el?.tagName === "P" ? Number(LEVEL.exec(el.getAttribute("style") ?? "")?.[1] ?? 0) : 0);
  for (const start of Array.from(root.querySelectorAll("p"))) {
    if (!start.isConnected || !levelOfItem(start)) continue;
    const stack: { level: number; list: Element }[] = [];
    for (let p: Element | null = start, level = levelOfItem(p); level; level = levelOfItem(p)) {
      const next: Element | null = p!.nextElementSibling;
      const marker = Array.from(p!.querySelectorAll("span")).find((span) => /mso-list:\s*ignore/i.test(span.getAttribute("style") ?? ""));
      const ordered = !!marker && /^\(?[0-9a-z]{1,4}[.)]$/i.test(textOf(marker));
      marker?.remove();
      const li = make(doc, "li");
      li.append(...Array.from(p!.childNodes));
      while (stack.length && stack.at(-1)!.level > level) stack.pop();
      if (!stack.length || stack.at(-1)!.level < level) {
        const list = make(doc, ordered ? "ol" : "ul");
        const parent = stack.at(-1)?.list;
        if (parent) (parent.lastElementChild ?? parent).append(list);
        else p!.before(list);
        stack.push({ level, list });
      }
      stack.at(-1)!.list.append(li);
      p!.remove();
      p = next;
    }
  }
}

/** Google Docs marks bold, italic and so on with inline styles; make them tags. */
function styleMarks(root: HTMLElement) {
  for (const span of Array.from(root.querySelectorAll("span[style]"))) {
    const style = (span.getAttribute("style") ?? "").toLowerCase().replace(/\s+/g, "");
    const tags = [
      /font-weight:(bold|[6-9]00)/.test(style) && "strong",
      /font-style:italic/.test(style) && "em",
      /text-decoration[^;]*underline/.test(style) && !span.closest("a") && "u",
      /text-decoration[^;]*line-through/.test(style) && "s",
    ].filter((tag): tag is string => !!tag);
    for (const tag of tags) {
      const mark = make(root.ownerDocument, tag);
      mark.append(...Array.from(span.childNodes));
      span.append(mark);
    }
  }
}

const ATTRIBUTES: Record<string, string[]> = {
  A: ["href"],
  TD: ["colspan", "rowspan"],
  TH: ["colspan", "rowspan"],
  INPUT: ["type", "checked"],
  OL: ["data-type"],
  UL: ["data-type"],
  LI: ["data-type", "data-checked"],
  ASIDE: ["data-type", "data-callout"],
  H1: ["class"],
};

function clean(root: HTMLElement, counts: ImportCounts, plainLists: WeakSet<Element>) {
  const doc = root.ownerDocument;
  root
    .querySelectorAll(
      'script, style, meta, link, title, template, noscript, svg, iframe, object, embed, video, audio, canvas, button, select, textarea, colgroup, input:not([type="checkbox"])',
    )
    .forEach((el) => el.remove());
  counts.images = root.querySelectorAll("img").length;
  root.querySelectorAll("img, picture").forEach((el) => el.remove());
  // Includes Word's <![if …]> markers around list numbers.
  for (const comment of commentsOf(root)) comment.remove();

  // Google Docs checklists, when pasted.
  for (const li of Array.from(root.querySelectorAll("li[aria-checked]"))) {
    const input = make(doc, "input", { type: "checkbox" });
    if (li.getAttribute("aria-checked") === "true") input.setAttribute("checked", "");
    li.prepend(input);
  }

  wordLists(root);
  styleMarks(root);

  // Word footnotes (mammoth lists them at the end): keep them a plain list, without the ↑ links back.
  for (const li of Array.from(root.querySelectorAll('li[id^="footnote-"], li[id^="endnote-"]'))) {
    if (li.parentElement) plainLists.add(li.parentElement);
  }
  root.querySelectorAll('a[href^="#footnote-ref"], a[href^="#endnote-ref"]').forEach((el) => el.remove());

  // A table of contents: lines that are only links within the document. The SOP makes its own.
  const contents = Array.from(root.querySelectorAll("p, li")).filter(
    (el) =>
      el.querySelector('a[href^="#"]') &&
      // Page numbers may sit outside the link.
      everyText(el, (node) => !!node.parentElement?.closest('a[href^="#"]') || /^[\s\d.]*$/.test(node.data)),
  );
  if (contents.length >= 2) contents.forEach((el) => el.remove());

  for (const a of Array.from(root.querySelectorAll("a"))) if (!safeHref(a.getAttribute("href"))) unwrap(a);
  for (const b of Array.from(root.querySelectorAll("b"))) {
    if (/font-weight:\s*(normal|[1-5]00)/i.test(b.getAttribute("style") ?? "")) unwrap(b);
    else rename(b, "strong");
  }
  for (const i of Array.from(root.querySelectorAll("i"))) rename(i, "em");
  for (const del of Array.from(root.querySelectorAll("del, strike"))) rename(del, "s");
  for (const el of Array.from(root.querySelectorAll("span, font, label, small, big, mark, abbr, cite, ins, sup, sub, figcaption"))) unwrap(el);
  // Containers: one with blocks inside goes; one with only text is a paragraph.
  for (const el of Array.from(root.querySelectorAll("div, section, article, main, header, footer, nav, center, figure")).reverse()) {
    if (el.querySelector(BLOCKS)) unwrap(el);
    else rename(el, "p");
  }

  for (const el of Array.from(root.querySelectorAll("*"))) {
    const keep = ATTRIBUTES[el.tagName] ?? [];
    for (const attr of Array.from(el.attributes)) if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
  }

  // A list inside a list (Google Docs pastes them so) belongs to the item before it.
  for (const list of Array.from(root.querySelectorAll("ul > ul, ul > ol, ol > ul, ol > ol"))) {
    const before = list.previousElementSibling;
    if (before?.tagName === "LI") before.append(list);
    else {
      const li = make(doc, "li");
      list.replaceWith(li);
      li.append(list);
    }
  }

  // Headings inside lists, tables and quotes read as bold lines there.
  for (const heading of Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"))) {
    if (heading.parentElement === root) continue;
    const strong = make(doc, "strong");
    strong.append(...Array.from(heading.childNodes));
    rename(heading, "p").append(strong);
  }

  // Headings are bold already.
  root.querySelectorAll("h1 strong, h2 strong, h3 strong, h4 strong, h5 strong, h6 strong").forEach(unwrap);

  removeEmpty(root);
}

function commentsOf(root: HTMLElement) {
  const walker = root.ownerDocument.createTreeWalker(root, SHOW_COMMENT);
  const nodes: ChildNode[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as ChildNode);
  return nodes;
}

function removeEmpty(root: HTMLElement) {
  for (const br of Array.from(root.children)) if (br.tagName === "BR") br.remove();
  for (const el of Array.from(root.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, th"))) trimEdges(el);
  for (const el of Array.from(root.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, aside")).reverse()) {
    if (!textOf(el) && !el.querySelector("table")) el.remove();
  }
  for (const list of Array.from(root.querySelectorAll("ul, ol")).reverse()) if (!list.querySelector("li")) list.remove();
  for (const row of Array.from(root.querySelectorAll("tr"))) if (!textOf(row)) row.remove();
  for (const table of Array.from(root.querySelectorAll("table"))) if (!table.querySelector("tr")) table.remove();
}

/* ---- Laying it out --------------------------------------------------------- */

/** The first heading, when nothing else is at its level or above: the document's title. */
function takeTitle(root: HTMLElement) {
  const tops = Array.from(root.children);
  const first = tops[0];
  const marked = tops.find((el) => el.tagName === "H1" && el.classList.contains("sop-title"));
  const standsAbove =
    isHeading(first) &&
    !tops.slice(1).some((el) => isHeading(el) && levelOf(el) <= levelOf(first)) &&
    (first.tagName === "H1" || tops.some((el) => isHeading(el) && el !== first));
  const title = marked ?? (standsAbove ? first : null);
  if (!title || !textOf(title)) return null;
  title.remove();
  return textOf(title).slice(0, 160);
}

/** The top heading level used becomes a section; the ones below it, subsections. */
function levelHeadings(root: HTMLElement) {
  const headings = Array.from(root.children).filter(isHeading);
  const top = Math.min(...headings.map(levelOf));
  for (const heading of headings) {
    if (CONTENTS_HEADING.test(textOf(heading))) heading.remove();
    else rename(heading, levelOf(heading) === top ? "h2" : "h3");
  }
}

/** Lists of ☐ items, and runs of ☐ lines, become checklists. */
function checklists(root: HTMLElement, plainLists: WeakSet<Element>) {
  const doc = root.ownerDocument;
  for (const list of Array.from(root.querySelectorAll("ul, ol"))) {
    if (list.hasAttribute("data-type") || plainLists.has(list)) continue;
    const items = Array.from(list.children).filter((el) => el.tagName === "LI");
    const checks = items.map((li) => checkOf(li, true));
    if (!items.length || checks.some((check) => !check)) continue;
    items.forEach((li, index) => {
      clearCheck(li, checks[index]!);
      li.setAttribute("data-type", "taskItem");
      li.setAttribute("data-checked", String(checks[index]!.checked));
    });
    rename(list, "ul", { "data-type": "taskList" });
  }

  for (let el = root.firstElementChild; el; el = el.nextElementSibling) {
    if (el.tagName !== "P" || !checkOf(el, false)) continue;
    const list = make(doc, "ul", { "data-type": "taskList" });
    el.before(list);
    for (let line = list.nextElementSibling; line?.tagName === "P"; line = list.nextElementSibling) {
      const check = checkOf(line, false);
      if (!check) break;
      clearCheck(line, check);
      const item = make(doc, "li", { "data-type": "taskItem", "data-checked": String(check.checked) });
      item.append(line);
      list.append(item);
    }
    el = list;
  }
}

/** A list straight under a "Checklist" or "Before you start" heading (or its one-line intro). */
function checklistsUnderHeadings(root: HTMLElement, plainLists: WeakSet<Element>) {
  for (const heading of Array.from(root.children).filter(isHeading)) {
    if (!CHECKLIST_HEADING.test(textOf(heading))) continue;
    let list = heading.nextElementSibling;
    if (list?.tagName === "P") list = list.nextElementSibling;
    if (list?.tagName !== "UL" || list.hasAttribute("data-type") || plainLists.has(list)) continue;
    for (const li of Array.from(list.children)) {
      li.setAttribute("data-type", "taskItem");
      li.setAttribute("data-checked", "false");
    }
    list.setAttribute("data-type", "taskList");
  }
}

function box(doc: Document, variant: CalloutVariant) {
  return make(doc, "aside", { "data-type": "callout", "data-callout": variant });
}

const BOXABLE = ["P", "UL", "OL", "TABLE", "BLOCKQUOTE", "PRE"];

/** "Note: …" lines, a "Tips:" line and the list under it, and one-cell tables become boxes. */
function callouts(root: HTMLElement) {
  const doc = root.ownerDocument;
  const made = new WeakSet<Element>();
  for (let el = root.firstElementChild; el; el = el.nextElementSibling) {
    if (el.tagName !== "P") continue;
    const prefix = calloutPrefix(el);
    if (!prefix) continue;
    const next = el.nextElementSibling;
    let aside: Element;
    if (prefix.rest) {
      aside = box(doc, prefix.variant);
      el.before(aside);
      dropLeading(el, prefix.length);
      aside.append(el);
    } else {
      // A label on its own line ("Tips:") boxes what comes under it.
      const labelled = prefix.emoji || /[:\-–—]\s*$/.test(textOf(el)) || allBold(el);
      if (!labelled || !next || !isTag(next, ...BOXABLE) || calloutPrefix(next)) continue;
      aside = box(doc, prefix.variant);
      el.replaceWith(aside);
      aside.append(next);
    }
    // "Do: …" twice in a row is one box.
    const before = aside.previousElementSibling;
    if (before && made.has(before) && before.getAttribute("data-callout") === prefix.variant) {
      before.append(...Array.from(aside.childNodes));
      aside.remove();
      el = before;
    } else {
      made.add(aside);
      el = aside;
    }
  }

  for (const table of Array.from(root.querySelectorAll("table"))) {
    const cells = table.querySelectorAll("td, th");
    if (table.parentElement !== root || cells.length !== 1) continue;
    const cell = cells[0];
    const first = cell.firstElementChild?.tagName === "P" ? cell.firstElementChild : null;
    const prefix = calloutPrefix(first ?? cell);
    if (prefix?.rest) dropLeading(first ?? cell, prefix.length);
    else if (prefix && first) first.remove();
    const aside = box(doc, prefix?.variant ?? "note");
    aside.append(...Array.from(cell.childNodes));
    table.replaceWith(aside);
  }
}

/** A short line in bold, with text under it, is a heading. */
function boldHeadings(root: HTMLElement) {
  const level = root.querySelector(":scope > h2") ? "h3" : "h2";
  for (let el = root.firstElementChild; el; el = el.nextElementSibling) {
    if (el.tagName !== "P" || el.querySelector("br, input") || !allBold(el)) continue;
    const text = textOf(el);
    const next = el.nextElementSibling;
    if (text.length < 2 || text.length > 80 || text.split(" ").length > 12 || /[.!,;]$/.test(text)) continue;
    if (STEP.test(text) || NUMBERED.test(text) || !next || isHeading(next)) continue;
    el = rename(el, level);
    el.querySelectorAll("strong").forEach(unwrap);
    dropTrailingColon(el);
  }
}

/** A heading that's only a label ("Tips", "Don'ts") over a short section: the section becomes that box. */
function labelledSections(root: HTMLElement) {
  const doc = root.ownerDocument;
  for (let el = root.firstElementChild; el; el = el.nextElementSibling) {
    if (!isHeading(el)) continue;
    const prefix = calloutPrefix(el);
    if (!prefix || prefix.rest) continue;
    const section: Element[] = [];
    for (let next = el.nextElementSibling; next && !isHeading(next) && next.tagName !== "HR"; next = next.nextElementSibling) section.push(next);
    if (!section.length || section.length > 4 || section.some((part) => part.tagName === "ASIDE")) continue;
    const aside = box(doc, prefix.variant);
    el.replaceWith(aside);
    aside.append(...section);
    el = aside;
  }
}

function stepList(doc: Document) {
  return make(doc, "ol", { "data-type": "steps" });
}

function asStep(li: Element) {
  li.setAttribute("data-type", "step");
  const prefix = stepPrefix(li);
  if (prefix) dropLeading(li, prefix);
  return li;
}

/** "Step 1: …" lines or headings, each with what's under it, up to the next heading. */
function stepRuns(root: HTMLElement) {
  const doc = root.ownerDocument;
  for (let el = root.firstElementChild; el; el = el.nextElementSibling) {
    if (!stepPrefix(el)) continue;
    const list = stepList(doc);
    el.before(list);
    let step: Element | null = null;
    for (let node = list.nextElementSibling; node; node = list.nextElementSibling) {
      const prefix = stepPrefix(node);
      if (prefix) {
        step = make(doc, "li", { "data-type": "step" });
        list.append(step);
        dropLeading(node, prefix);
        if (!textOf(node)) node.remove();
        else if (isHeading(node)) {
          // The step's name, in bold, over its details.
          const name = make(doc, "p");
          const strong = make(doc, "strong");
          strong.append(...Array.from(node.childNodes));
          name.append(strong);
          node.remove();
          step.append(name);
        } else step.append(node);
      } else if (isHeading(node) || node.tagName === "HR" || !step) break;
      else step.append(node);
    }
    el = list;
  }
}

/** "1. …", "2. …" typed as plain lines. */
function numberedLines(root: HTMLElement) {
  const doc = root.ownerDocument;
  for (let el = root.firstElementChild; el; el = el.nextElementSibling) {
    if (el.tagName !== "P" || Number(NUMBERED.exec(normal(el.textContent ?? ""))?.[1]) !== 1) continue;
    const run: Element[] = [];
    for (let line: Element | null = el; line?.tagName === "P"; line = line.nextElementSibling) {
      const match = NUMBERED.exec(normal(line.textContent ?? ""));
      if (Number(match?.[1]) !== run.length + 1) break;
      run.push(line);
    }
    if (run.length < 2) continue;
    const list = stepList(doc);
    el.before(list);
    for (const line of run) {
      dropLeading(line, NUMBERED.exec(normal(line.textContent ?? ""))![0].length);
      const step = make(doc, "li", { "data-type": "step" });
      step.append(line);
      list.append(step);
    }
    el = list;
  }
}

/** Numbered lists (and lists of "Step 1: …") become steps. One broken by a few lines carries on. */
function numberedLists(root: HTMLElement, plainLists: WeakSet<Element>) {
  const isPlainList = (el: Element | null): el is Element => !!el && isTag(el, "OL", "UL") && !el.hasAttribute("data-type") && !plainLists.has(el);
  const isNumbered = (el: Element | null) =>
    isPlainList(el) &&
    (el.tagName === "OL" ||
      Array.from(el.children).every((li) => li.tagName === "LI" && stepPrefix(li)));
  for (let el = root.firstElementChild; el; el = el.nextElementSibling) {
    if (!isNumbered(el)) continue;
    const list = rename(el, "ol", { "data-type": "steps" });
    Array.from(list.children).forEach(asStep);
    for (;;) {
      const between: Element[] = [];
      let next = list.nextElementSibling;
      while (next && between.length < 4 && isTag(next, "P", "UL", "TABLE", "ASIDE", "BLOCKQUOTE", "PRE") && !isNumbered(next)) {
        between.push(next);
        next = next.nextElementSibling;
      }
      if (!next || !isNumbered(next) || next.tagName !== "OL" || between.length > 3) break;
      list.lastElementChild?.append(...between);
      for (const li of Array.from(next.children)) list.append(asStep(li));
      next.remove();
    }
    el = list;
  }
}

/** Header rows, when a table's first row is all bold. */
function tables(root: HTMLElement) {
  for (const table of Array.from(root.querySelectorAll("table"))) {
    const rows = table.querySelectorAll("tr");
    const cells = Array.from(rows[0]?.children ?? []);
    if (rows.length < 2 || cells.length < 2 || rows[0].querySelector("th")) continue;
    if (!cells.every((cell) => !textOf(cell) || allBold(cell)) || !cells.some((cell) => textOf(cell))) continue;
    for (const cell of cells) {
      cell.querySelectorAll("strong").forEach(unwrap);
      const span: Record<string, string> = {};
      for (const name of ["colspan", "rowspan"]) {
        const value = cell.getAttribute(name);
        if (value) span[name] = value;
      }
      rename(cell, "th", span);
    }
  }
}

/**
 * Lays a document out as an SOP. With `findTitle`, a title heading is taken
 * out and returned (for a whole document, not a paste).
 */
export function tidySop(html: string, { findTitle = false } = {}): ImportResult {
  const root = new DOMParser().parseFromString(html, "text/html").body;
  const counts: ImportCounts = { sections: 0, steps: 0, checklists: 0, callouts: 0, tables: 0, images: 0 };
  const plainLists = new WeakSet<Element>();

  clean(root, counts, plainLists);
  const title = findTitle ? takeTitle(root) : null;
  levelHeadings(root);
  checklists(root, plainLists);
  callouts(root);
  boldHeadings(root);
  checklistsUnderHeadings(root, plainLists);
  labelledSections(root);
  stepRuns(root);
  numberedLines(root);
  numberedLists(root, plainLists);
  tables(root);
  removeEmpty(root);

  counts.sections = root.querySelectorAll("h2").length;
  counts.steps = root.querySelectorAll('li[data-type="step"]').length;
  counts.checklists = root.querySelectorAll('ul[data-type="taskList"]').length;
  counts.callouts = root.querySelectorAll("aside").length;
  counts.tables = root.querySelectorAll("table").length;
  return { html: root.innerHTML, title, counts };
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "4 sections, 9 steps, 2 callout boxes", for the toast after an import. */
export function describeImport({ sections, steps, checklists, callouts, tables }: ImportCounts) {
  const parts = [
    sections && plural(sections, "section"),
    steps && plural(steps, "step"),
    checklists && plural(checklists, "checklist"),
    callouts && plural(callouts, "callout box", "callout boxes"),
    tables && plural(tables, "table"),
  ].filter(Boolean);
  return parts.length ? `Laid out as ${parts.join(", ")}.` : "No headings, steps or lists found: it's in as plain text.";
}
