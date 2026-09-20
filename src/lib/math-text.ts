/**
 * LaTeX-aware text splitting — প্রশ্ন/অপশন/ব্যাখ্যার ভেতরের ম্যাথ অংশ চেনা।
 *
 * সমর্থিত রূপ (পুরনো অ্যাপ/প্রশ্নব্যাংক থেকে পেস্ট করা কনটেন্টেও যাতে কাজ করে):
 *   - `$...$`        ইনলাইন ম্যাথ (একাধিক লাইনে ভাঙা থাকলেও চলে)
 *   - `\(...\)`      ইনলাইন ম্যাথ
 *   - `$$...$$`      ডিসপ্লে (ব্লক) ম্যাথ
 *   - `\[...\]`      ডিসপ্লে (ব্লক) ম্যাথ
 *   - `[math]...[/math]`  BBCode ধাঁচ (Moodle/পুরনো ফোরামের প্রচলিত নিয়ম)
 *   - `\begin{env}...\end{env}`  ডেলিমিটার ছাড়া environment (align, cases, pmatrix…)
 *   - ডেলিমিটার ছাড়া খালি LaTeX কমান্ড — `\frac{1}{2}`, `\sqrt{2}`, `\alpha^2` ইত্যাদি
 *     (বই/Word থেকে কপি করা কনটেন্টে সাধারণত এভাবেই থাকে)
 *
 * এই ফাইলটি ইচ্ছাকৃতভাবে React-মুক্ত ও খাঁটি (pure) — কারণ
 * `question-parser.ts` সার্ভার অ্যাকশনেও চলে, আর ওখান থেকেও একই নিয়ম
 * দরকার (ম্যাথ স্প্যান mask করে রাখা, যাতে অপশন-মার্কার regex ম্যাথের
 * ভেতরের `a)` বা `2)`-কে ভুল করে অপশন ভাবতে না পারে)।
 */

/** স্বীকৃত LaTeX কমান্ড — অনির্দিষ্ট `\abc` কে ম্যাথ ধরে ফেললে সাধারণ টেক্সট ভেঙে যেত */
const COMMAND_NAMES = [
  // ভগ্নাংশ, মূল, যোগ-বিয়োগ
  "frac", "dfrac", "tfrac", "sqrt", "sum", "prod", "int", "oint", "iint",
  // লিমিট ও ফাংশন
  "lim", "log", "ln", "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan",
  "min", "max", "sup", "inf", "arg", "deg", "det", "dim", "ker", "gcd", "lcm", "mod", "bmod", "pmod",
  // গ্রিক
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta",
  "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "varpi", "rho", "sigma", "tau", "upsilon",
  "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  // সম্পর্ক ও চিহ্ন
  "times", "cdot", "div", "pm", "mp", "leq", "le", "geq", "ge", "neq", "ne", "approx", "equiv",
  "propto", "sim", "cong", "infty", "partial", "nabla", "forall", "exists", "nexists", "emptyset",
  "in", "notin", "subset", "supset", "subseteq", "supseteq", "cup", "cap", "therefore", "because",
  "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "leftrightarrow", "Leftrightarrow",
  "to", "mapsto", "implies", "iff", "circ", "degree", "angle", "triangle", "parallel", "perp",
  "ldots", "cdots", "vdots", "ddots", "prime", "ell", "hbar", "Re", "Im",
  // কাঠামো ও ফরম্যাটিং
  "vec", "bar", "hat", "tilde", "dot", "ddot", "overline", "underline", "overbrace", "underbrace",
  "left", "right", "big", "Big", "bigg", "Bigg", "text", "textrm", "mathrm", "mathbb", "mathcal",
  "mathbf", "operatorname", "quad", "qquad", "space", "binom", "cancel", "color", "boxed",
  "displaystyle", "limits", "overset", "underset", "stackrel",
  // environment
  "begin", "end", "pmatrix", "bmatrix", "vmatrix", "cases", "array", "matrix", "aligned", "align",
  "gather", "split",
];

/** `{...}` — এক স্তর নেস্টিং পর্যন্ত (যেমন `\frac{\sqrt{2}}{2}`) */
const BRACE_GROUP = "\\{(?:[^{}]|\\{[^{}]*\\})*\\}";
const BRACKET_GROUP = "\\[[^\\[\\]]*\\]";
const SCRIPT_ATOM = "[\\^_](?:\\{?[^{}\\s]\\}?)";
const TRAILING_GROUPS = `(?:\\s*(?:${BRACE_GROUP}|${BRACKET_GROUP}|${SCRIPT_ATOM}))*`;
// `(?![a-zA-Z])` — নইলে "C:\tools" জাতীয় টেক্সটের `\to` কে ম্যাথ ভাবা যেত
const BARE_LATEX = `\\\\(?:${COMMAND_NAMES.join("|")})(?![a-zA-Z])${TRAILING_GROUPS}`;

/**
 * ডেলিমিটারসহ একটা পূর্ণ ম্যাথ স্প্যান। ক্রম গুরুত্বপূর্ণ:
 * `$$` ⟶ `\[` ⟶ `\(` ⟶ `[math]` ⟶ `$...$` ⟶ `\begin…\end` ⟶ খালি কমান্ড।
 * `\begin…\end` ব্যাকরেফারেন্স দিয়ে environment মেলানো হয় — তাই এটা খালি-কমান্ড
 * নিয়মের আগে বসানো, নইলে `\begin{cases}` আলাদা টুকরো হয়ে যেত।
 */
const MATH_SPAN_RE = new RegExp(
  [
    "\\$\\$[\\s\\S]+?\\$\\$",
    "\\\\\\[[\\s\\S]+?\\\\\\]",
    "\\\\\\([\\s\\S]+?\\\\\\)",
    "\\[math\\][\\s\\S]*?\\[/math\\]",
    // ইনলাইন `$...$`: একাধিক লাইনে ভাঙা থাকতে পারে, কিন্তু ফাঁকা লাইন পার হয় না
    "\\$(?:(?!\\n[ \\t]*\\n)[^$])+?\\$",
    "\\\\begin\\{([a-zA-Z*]+)\\}[\\s\\S]*?\\\\end\\{\\1\\}",
    BARE_LATEX,
  ].join("|"),
  "gi"
);

/** ম্যাথ স্প্যানে tex আর display দুটোই থাকে; সাধারণ টেক্সট সেগমেন্টে শুধু value */
export type MathSegment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

/**
 * LaTeX-এ `%` কমেন্ট শুরু করে — `$50%$` লিখলে KaTeX চুপচাপ শুধু "50" দেখাত
 * (বাকিটা কেটে যেত)। তাই এস্কেপ করা না থাকলে `\%` বানিয়ে দেওয়া হয়।
 */
function normalizeTex(tex: string): string {
  return tex.replace(/\\?%/g, (m) => (m === "%" ? "\\%" : m));
}

/** ডেলিমেটর বাদ দিয়ে tex বের করা */
function unwrapMath(raw: string): { tex: string; display: boolean } {
  if (raw.startsWith("$$") && raw.endsWith("$$") && raw.length >= 4) {
    return { tex: normalizeTex(raw.slice(2, -2)), display: true };
  }
  if (raw.startsWith("\\[") && raw.endsWith("\\]")) {
    return { tex: normalizeTex(raw.slice(2, -2)), display: true };
  }
  if (raw.startsWith("\\(") && raw.endsWith("\\)")) {
    return { tex: normalizeTex(raw.slice(2, -2)), display: false };
  }
  if (/^\[math\]/i.test(raw)) {
    const tex = normalizeTex(raw.replace(/^\[math\]/i, "").replace(/\[\/math\]$/i, ""));
    // একাধিক লাইনের বা environment-ভিত্তিক হলে ব্লক হিসেবেই দেখানো ভালো
    return { tex, display: /\n|\\begin\{/.test(tex) };
  }
  if (raw.startsWith("$") && raw.endsWith("$") && raw.length >= 2) {
    return { tex: normalizeTex(raw.slice(1, -1)), display: false };
  }
  if (/^\\begin\{/.test(raw)) {
    // ডেলিমিটার ছাড়া environment — ব্লক হিসেবেই দেখানো হয়
    return { tex: normalizeTex(raw), display: true };
  }
  // ডেলিমিটার ছাড়া খালি LaTeX কমান্ড (\frac{1}{2}) — বাক্যের ভেতরেই বসে
  return { tex: normalizeTex(raw), display: false };
}

/** টেক্সটকে টেক্সট/ম্যাথ সেগমেন্টে ভাগ করা (ম্যাচ না থাকলে একটাই text সেগমেন্ট) */
export function splitMathSegments(text: string): MathSegment[] {
  if (!text) return [];
  const out: MathSegment[] = [];
  const source = String(text);
  let lastIndex = 0;

  MATH_SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MATH_SPAN_RE.exec(source)) !== null) {
    const raw = m[0];
    // শূন্য-দৈর্ঘ্য ম্যাচ হলে লুপ আটকে যেত
    if (!raw) {
      MATH_SPAN_RE.lastIndex += 1;
      continue;
    }
    if (m.index > lastIndex) {
      out.push({ type: "text", value: source.slice(lastIndex, m.index) });
    }
    const { tex, display } = unwrapMath(raw);
    out.push({ type: "math", value: tex, display });
    lastIndex = m.index + raw.length;
  }

  if (lastIndex < source.length) {
    out.push({ type: "text", value: source.slice(lastIndex) });
  }
  return out;
}

/** টেক্সটে আদৌ ম্যাথ আছে কি না (দ্রুত চেক — অপ্রয়োজনে katex চালানো এড়াতে) */
export function containsMath(text: string): boolean {
  if (!text) return false;
  MATH_SPAN_RE.lastIndex = 0;
  return MATH_SPAN_RE.test(String(text));
}

/* ------------------------------------------------------------------ *
 * পarser-এর জন্য mask/unmask
 *
 * bulk import পarser লাইনভিত্তিক এবং অপশন-মার্কার regex ব্যবহার করে।
 * ম্যাথ সোর্সের ভেতরে `\frac{1}{2})` বা `\begin{aligned}` জাতীয় অংশ
 * থাকলে সেগুলো ভুল করে "২)" অপশন বা টপিক-হেডার হিসেবে ধরা পড়তে পারে।
 * তাই regex চালানোর আগে ম্যাথ স্প্যানগুলো এক-টোকেন প্লেসহোল্ডারে বদলে
 * রাখা হয়, আর পার্স শেষে আসল টেক্সট ফিরিয়ে দেওয়া হয়।
 * ------------------------------------------------------------------ */

const PLACEHOLDER_RE = /\u0000(\d+)\u0000/g;

/**
 * ম্যাথ স্প্যানগুলো প্লেসহোল্ডারে বদলায়। স্প্যানের ভেতরের নতুন লাইনগুলো
 * প্লেসহোল্ডারের পরে হুবহু ফিরিয়ে দেওয়া হয়, যাতে প্যারাগ্রাফ/লাইন কাঠামো
 * (প্রশ্ন ও ব্যাখ্যার ফাঁকা লাইন) আগের মতোই থাকে।
 */
export function maskMathSpans(text: string): { masked: string; spans: string[] } {
  if (!text) return { masked: text, spans: [] };
  const spans: string[] = [];
  const masked = String(text).replace(MATH_SPAN_RE, (raw) => {
    const idx = spans.push(raw) - 1;
    const newlines = raw.match(/\n/g);
    return `\u0000${idx}\u0000${newlines ? "\n".repeat(newlines.length) : ""}`;
  });
  return { masked, spans };
}

/** প্লেসহোল্ডারগুলো ফিরিয়ে আসল ম্যাথ সোর্স বসানো (spans খালি হলে টেক্সট অপরিবর্তিত) */
export function unmaskMathSpans(text: string, spans: string[]): string {
  if (!text) return text;
  if (!spans || spans.length === 0) return text;
  return String(text).replace(PLACEHOLDER_RE, (whole, digits: string) => {
    const idx = Number(digits);
    return Number.isInteger(idx) && idx >= 0 && idx < spans.length ? spans[idx] : whole;
  });
}
