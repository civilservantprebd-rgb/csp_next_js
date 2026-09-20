/**
 * DeepSeek ক্লায়েন্ট — শুধু টেক্সট ইনপুট, তবে JSON মোড সমর্থিত।
 *
 * JSON মোড (`response_format: json_object`) ব্যবহার করা হয় যাতে মডেল নিজেই
 * কাঠামো ঠিক করে দেয় — কোনটা নতুন প্রশ্ন, কোনটা অপশন, কোনটা উত্তর। ফলে
 * আমাদের regex আর অনুমান করে না, শুধু যাচাই করে।
 *
 * API key কখনো লগ বা এরর-মেসেজে যায় না।
 */

export interface DeepSeekCallOptions {
  apiKey: string;
  model: string;
  prompt: string;
  baseUrl?: string;
  /** JSON অবজেক্ট ফেরানোর নির্দেশ (DeepSeek-এর Json Output) */
  jsonMode?: boolean;
  /**
   * thinking mode বন্ধ করা (ডিফল্ট: বন্ধ)। আমাদের কাজ যান্ত্রিক — মাপা গেছে,
   * thinking চালু থাকলে আউটপুট token-এর ~৮০% শুধু ভেতরের চিন্তায় নষ্ট হয়,
   * খরচ ৩-৪ গুণ আর সময়ও অনেক বেশি লাগে। `DEEPSEEK_THINKING=on` দিয়ে চালু করা যায়।
   */
  disableThinking?: boolean;
  /** আউটপুট-খরচের সিলিং — কোনোদিন যেন অস্বাভাবিক বড় উত্তর খরচ না বাড়ায় */
  maxTokens?: number;
}

export interface DeepSeekResult {
  text: string;
  /** "length" হলে উত্তর কাটা পড়েছে — UI শিক্ষককে সেটা জানায় */
  finishReason?: string;
}

export async function callDeepSeek(opts: DeepSeekCallOptions): Promise<DeepSeekResult> {
  const base = (opts.baseUrl || "https://api.deepseek.com").replace(/\/+$/, "");
  const noThinking = opts.disableThinking !== false;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: "user", content: opts.prompt }],
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(noThinking ? { thinking: { type: "disabled" }, temperature: 0 } : {}),
      max_tokens: opts.maxTokens ?? 8000,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek API এরর (${res.status}): ${body.slice(0, 300)}`);
  }

  const json: any = await res.json();
  const choice = json?.choices?.[0];
  const content = choice?.message?.content;

  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content.map((part: any) => (typeof part === "string" ? part : part?.text || "")).join("");
  }

  return { text, finishReason: choice?.finish_reason };
}
