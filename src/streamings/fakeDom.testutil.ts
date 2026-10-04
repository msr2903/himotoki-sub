/**
 * A minimal DOM double for caption-adapter unit tests (vitest runs in node): elements, text nodes,
 * a small selector matcher (tag, #id, .class, [attr="v"], [attr*='v'], descendant and comma lists)
 * and a MutationObserver whose callbacks the test triggers.
 */
export class FakeText {
  readonly nodeType = 3;
  readonly nodeName = "#text";
  parentNode: FakeElement | null = null;
  readonly childNodes: never[] = [];
  constructor(public data: string) {}
  get textContent() {
    return this.data;
  }
  get nextSibling() {
    return siblingAfter(this);
  }
}

type Child = FakeElement | FakeText;

const siblingAfter = (node: Child): Child | null => {
  const siblings = node.parentNode?.childNodes ?? [];
  return siblings[siblings.indexOf(node) + 1] ?? null;
};

export class FakeElement {
  readonly nodeType = 1;
  readonly nodeName: string;
  parentNode: FakeElement | null = null;
  childNodes: Child[] = [];
  attrs: Record<string, string>;
  src = "blob:video";
  currentTime = 0;

  constructor(tag: string, attrs: Record<string, string> = {}, children: Array<Child | string> = []) {
    this.nodeName = tag.toUpperCase();
    this.attrs = attrs;
    for (const child of children) this.append(typeof child === "string" ? new FakeText(child) : child);
  }

  append(child: Child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join("");
  }

  get nextSibling() {
    return siblingAfter(this);
  }

  contains(node: Child | null): boolean {
    for (let n: Child | FakeElement | null = node; n; n = n.parentNode) if (n === this) return true;
    return false;
  }

  private descendants(): FakeElement[] {
    const out: FakeElement[] = [];
    const walk = (el: FakeElement) => {
      for (const child of el.childNodes) {
        if (child instanceof FakeElement) {
          out.push(child);
          walk(child);
        }
      }
    };
    walk(this);
    return out;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const lists = selector.split(",").map((s) => s.trim().split(/\s+/));
    return this.descendants().filter((el) => lists.some((chain) => matchesChain(el, chain, this)));
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

const matchesSimple = (el: FakeElement, simple: string): boolean => {
  const re = /#([\w-]+)|\.([\w-]+)|\[([\w-]+)(\*?=)["']([^"']*)["']\]/gi;
  const tag = /^[a-z0-9]+/i.exec(simple)?.[0];
  if (tag && el.nodeName !== tag.toUpperCase()) return false;
  for (const m of simple.matchAll(re)) {
    if (m[1] && el.attrs.id !== m[1]) return false;
    if (m[2] && !(el.attrs.class ?? "").split(/\s+/).includes(m[2])) return false;
    if (m[3]) {
      const value = el.attrs[m[3]];
      if (value === undefined) return false;
      if (m[4] === "=" ? value !== m[5] : !value.includes(m[5]!)) return false;
    }
  }
  return true;
};

const matchesChain = (el: FakeElement, chain: string[], root: FakeElement): boolean => {
  if (!matchesSimple(el, chain[chain.length - 1]!)) return false;
  let rest = chain.slice(0, -1);
  for (let a = el.parentNode; a && rest.length && a !== root; a = a.parentNode) {
    if (matchesSimple(a, rest[rest.length - 1]!)) rest = rest.slice(0, -1);
  }
  return rest.length === 0;
};

export class FakeMutationObserver {
  static all: FakeMutationObserver[] = [];
  target: unknown = null;
  options: MutationObserverInit | null = null;
  connected = false;
  constructor(private callback: () => void) {
    FakeMutationObserver.all.push(this);
  }
  observe(target: unknown, options: MutationObserverInit) {
    this.target = target;
    this.options = options;
    this.connected = true;
  }
  disconnect() {
    this.connected = false;
  }
  /** Deliver a mutation record, as the browser would (even a late one already queued). */
  trigger() {
    this.callback();
  }
  static live() {
    return FakeMutationObserver.all.filter((o) => o.connected);
  }
}

/** Install `body` as the document and the observer double as globals. */
export function installFakeDom(body: FakeElement) {
  FakeMutationObserver.all = [];
  return {
    document: { querySelector: (s: string) => body.querySelector(s), querySelectorAll: (s: string) => body.querySelectorAll(s) },
    MutationObserver: FakeMutationObserver,
    Node: { TEXT_NODE: 3 },
  };
}
