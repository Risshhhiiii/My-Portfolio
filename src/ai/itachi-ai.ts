// ═══════════════════════════════════════════════════════════════════════════
// ITACHI UCHIHA AI ENGINE — High-Throughput Client-Side Streaming Orchestrator
// Rishi Raj Sharma Portfolio Intelligence
// ═══════════════════════════════════════════════════════════════════════════

import { SYSTEM_PROMPT } from '../knowledge/context';
import { fetchGithubContext } from '../lib/github';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

let cachedSystemPrompt: string | null = null;
let isInitializing = false;

export async function getInitializedSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 50));
    }
    if (cachedSystemPrompt) return cachedSystemPrompt;
  }

  isInitializing = true;
  try {
    const ghContext = await fetchGithubContext();
    cachedSystemPrompt = SYSTEM_PROMPT.replace('{GITHUB_CONTEXT}', ghContext);
  } catch {
    cachedSystemPrompt = SYSTEM_PROMPT.replace('{GITHUB_CONTEXT}', 'GitHub real-time data sync active.');
  } finally {
    isInitializing = false;
  }

  return cachedSystemPrompt;
}

function cleanResponseText(text: string): string {
  // Strips any internal reasoning/thinking tags
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^(\d+\.\s*(Analyze|Check|Draft|Think|Output).*?\n)+/gis, '')
    .trimStart();
}

// ── GOOGLE GEMINI STREAMING (Primary Engine: Gemini 3.6 Flash) ────────────
async function streamGemini(
  systemPrompt: string,
  history: { role: string; content: string }[],
  apiKey: string,
  signal: AbortSignal,
  onChunk: (chunk: string, accumulated: string) => void
): Promise<string> {
  const firstUserIdx = history.findIndex(m => m.role === 'user');
  const validHistory = firstUserIdx >= 0 ? history.slice(firstUserIdx) : history;

  const contents = validHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const models = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3.5-flash'];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey.trim()}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 2048
          }
        })
      });

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        throw new Error(`Gemini (${model}) ${res.status}: ${errTxt.slice(0, 120)}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Gemini stream reader unavailable.');

      const decoder = new TextDecoder('utf-8');
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const json = JSON.parse(dataStr);
            const delta = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (delta) {
              accumulated += delta;
              const cleaned = cleanResponseText(accumulated);
              if (cleaned) onChunk(delta, cleaned);
            }
          } catch {
            // skip malformed
          }
        }
      }

      return cleanResponseText(accumulated);
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed.');
}

// ── GROQ STREAMING (Ultra-Fast Fallback) ───────────────────────────────────
async function streamGroq(
  systemPrompt: string,
  history: { role: string; content: string }[],
  apiKey: string,
  signal: AbortSignal,
  onChunk: (chunk: string, accumulated: string) => void
): Promise<string> {
  const models = ['groq/compound', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content }))
  ];

  let lastErr: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`
        },
        signal,
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: 0.65,
          max_tokens: 2048
        })
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Groq (${model}) ${res.status}: ${errorText.slice(0, 120)}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Groq stream reader unavailable.');

      const decoder = new TextDecoder('utf-8');
      let rawAccumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const json = JSON.parse(dataStr);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              rawAccumulated += delta;
              const cleaned = cleanResponseText(rawAccumulated);
              if (cleaned) onChunk(delta, cleaned);
            }
          } catch {
            // Skip
          }
        }
      }

      return cleanResponseText(rawAccumulated);
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      lastErr = err;
    }
  }

  throw lastErr || new Error('All Groq models failed.');
}

// ── OFFLINE TSUKUYOMI SHADOW CACHE ─────────────────────────────────────────
export function getItachiOfflineTelemetry(prompt: string): string {
  const q = prompt.toLowerCase();

  if (q.includes('finai') || q.includes('finance') || q.includes('voice') || q.includes('money') || q.includes('slm') || q.includes('qwen') || q.includes('ollama')) {
    return `───────────────
OFFLINE SHADOW CACHE · FIN-AI VOICE ASSISTANT
───────────────
The live neural stream is resting. Accessing offline shadow telemetry on Rishi Raj Sharma's flagship major project:

FIN-AI: A VOICE-FIRST PERSONAL FINANCE ASSISTANT (Oct. 2026 – Present)
• THE GOLDEN INVARIANT: "The AI Never Does Math." LLMs are probabilistic token predictors. 100% of financial math is computed deterministically via Python decimal.Decimal and PostgreSQL 16 NUMERIC(14,2). The AI acts strictly as an Intent Classifier and Tool Dispatcher.
• QUAD-MODAL FEEDBACK: Spoken neural audio (Edge-TTS), contextual advice, interactive Proceed Cards (two-phase commit safety gate), and live dashboard synchronization with budget alerts.
• DUAL-BRAIN HYBRID AI: Private Mode (fine-tuned Qwen3-1.7B finai-v4 via QLoRA, 4-bit GGUF via Ollama in 1.1 GB RAM, ~35 ms/token, 100% multi-turn context retention) + Groq cloud fallback (Llama 3.3 + Whisper Large-v3-Turbo).
• LOCAL CPU FAST-PATH: 3 local scikit-learn models achieving 99.3% accuracy in 1.3 ms for expense categorization and a 39 ms offline fast path for common balance queries (0 AI tokens).
• VERIFICATION: 997 Automated Tests (852 unit + 145 integration) passing in 4.21s.
• STACK: Python · FastAPI · PostgreSQL 16 · Qwen3-1.7B · Ollama · Scikit-Learn · Redis · Docker · Edge-TTS
• REPOSITORY: https://github.com/Risshhhiiii/FinAI---Voice-First-Personal-Finance-Assistant`;
  }

  if (q.includes('project') || q.includes('work') || q.includes('newsroom') || q.includes('microservice') || q.includes('cnn')) {
    return `───────────────
OFFLINE SHADOW CACHE · PROJECT TELEMETRY
───────────────
The live neural stream is momentarily resting due to rate limits or chakra exhaustion. Accessing offline telemetry on Rishi Raj Sharma's flagship systems:

1. FIN-AI (Voice-First Personal Finance Assistant):
   - Quad-modal feedback engine, dual-brain SLM (finai-v4 Qwen3-1.7B, 1.1 GB RAM), deterministic Python Decimal accounting, and 997 automated tests.
   - 1.3ms local CPU scikit-learn categorization (99.3% accuracy) + 39ms offline query path.

2. NEWSROOM AI (Sentiment & Summarizer):
   - Ingests public commentary via async FastAPI & MongoDB (<140ms latency).
   - Fine-grained 7-class emotion classification using DistilRoBERTa + Gemini executive brief generation.

3. HOSPITAL MANAGEMENT MICROSERVICES:
   - Decentralized healthcare architecture on Spring Boot & Spring Cloud.
   - Dynamic Eureka routing (Port 8761), Reactive Gateway (Port 9191), and Zipkin request tracing.

4. CNN TOUCHLESS MEDIA PLAYER:
   - Touchless HCI controller streaming live at 30 FPS with OpenCV & deep Convolutional Neural Networks.

5. UCHIHA ITACHI CINEMATIC PORTFOLIO:
   - WebGL & Canvas cinematic experience featuring Tsukuyomi scroll scrubbing and real-time gaze constellation.

Re-engage the terminal in a moment once live chakra streams replenish.`;
  }

  if (q.includes('skill') || q.includes('stack') || q.includes('tech') || q.includes('language') || q.includes('certif')) {
    return `───────────────
OFFLINE SHADOW CACHE · ARSENAL & SKILLS
───────────────
The live connection is resting. Offline technical telemetry for Rishi Raj Sharma:

- PROGRAMMING: Python, Java, SQL, C++, JavaScript
- AI & SLM: Qwen3-1.7B, Ollama, Scikit-Learn, TensorFlow, OpenCV, DistilRoBERTa, Google Gemini API
- BACKEND & ARCHITECTURE: FastAPI, Spring Boot, Spring Cloud (Eureka, Gateway), Django, REST APIs, Microservices
- DATABASES & CLOUD: PostgreSQL 16 (Asyncpg), MongoDB, Redis, AWS (Cloud Practitioner, GenAI), Docker
- TESTING & DEVOPS: 997 Automated Pytests, JUnit, JMeter, Postman, Git/GitHub, Linux/Bash
- CREDENTIALS: AWS CCP (June 2026), JPMorgan Software Engineering Simulation, Infosys Finacle, VISAI '26

Re-summon your inquiry shortly once the live stream re-establishes.`;
  }

  if (q.includes('contact') || q.includes('email') || q.includes('phone') || q.includes('reach') || q.includes('hire')) {
    return `───────────────
OFFLINE SHADOW CACHE · TRANSMISSION CHANNELS
───────────────
Direct communication coordinates with Rishi Raj Sharma:

- Email: rishisharma21950@gmail.com
- Phone: +91 6362987264
- GitHub: https://github.com/Risshhhiiii
- LinkedIn: https://www.linkedin.com/in/rishi-raj-sharma-9b5168344
- Stationed: BITM, Ballari, Karnataka, India

You can also summon a direct scroll transmission via the dispatch form in Act 05 below.`;
  }

  return `───────────────
OFFLINE SHADOW CACHE · RISHI RAJ SHARMA
───────────────
The live neural stream is momentarily recharging due to token traffic. Rishi's core shadow telemetry remains accessible:

Rishi Raj Sharma is an AI & Product Development Engineer at BITM Ballari (2023–2027), forging intelligent, voice-driven systems and scalable AI products from the shadows.

OVERVIEW:
- Core Domains: Voice Intelligence, Private SLMs, Distributed Microservices, Cloud Architectures
- Flagship Systems: FIN-AI (Voice Finance Assistant, 997 tests), Newsroom AI (<140ms), Hospital Management Microservices, CNN Touchless Media Player (30 FPS)
- Top Credentials: AWS Certified Cloud Practitioner, JPMorgan Chase Software Engineering, Infosys Finacle Training, VISAI '26 Finalist

Re-engage this inquiry in a few moments once the live chakra stream replenishes.`;
}

// ── ORCHESTRATED INFERENCE PIPELINE ─────────────────────────────────────────
export interface InferenceOptions {
  history: ChatMessage[];
  signal: AbortSignal;
  onChunk: (chunk: string, accumulated: string) => void;
  onProviderChange?: (provider: 'GEMINI // 3.6-FLASH' | 'GROQ // FAST-INFERENCE' | 'OFFLINE // SHADOW-CACHE') => void;
}

export async function askItachi(
  prompt: string,
  options: InferenceOptions
): Promise<{ text: string; provider: string }> {
  const systemPrompt = await getInitializedSystemPrompt();

  const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  const groqKey = (import.meta.env.VITE_GROQ_API_KEY || '').trim();

  const cleanHistory = options.history
    .slice(-14)
    .map(m => ({ role: m.role, content: m.content }));

  // Append current prompt to history
  cleanHistory.push({ role: 'user', content: prompt });

  let output = '';

  // 1. Primary Engine: Google Gemini 3.6 Flash
  if (geminiKey) {
    try {
      options.onProviderChange?.('GEMINI // 3.6-FLASH');
      output = await streamGemini(systemPrompt, cleanHistory, geminiKey, options.signal, options.onChunk);
      if (output.trim()) {
        return { text: output, provider: 'GEMINI // 3.6-FLASH' };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.warn('Gemini inference failed, attempting Groq fallback...', err);
    }
  }

  // 2. Fallback Engine: Groq
  if (groqKey) {
    try {
      options.onProviderChange?.('GROQ // FAST-INFERENCE');
      output = await streamGroq(systemPrompt, cleanHistory, groqKey, options.signal, options.onChunk);
      if (output.trim()) {
        return { text: output, provider: 'GROQ // FAST-INFERENCE' };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.warn('Groq fallback failed, engaging Offline Shadow Cache...', err);
    }
  }

  // 3. Graceful Offline Shadow Cache Fallback (Zero Raw Errors)
  options.onProviderChange?.('OFFLINE // SHADOW-CACHE');
  const fallbackText = getItachiOfflineTelemetry(prompt);
  
  // Simulate rapid streaming of cached data for visual continuity
  for (let i = 0; i <= fallbackText.length; i += 25) {
    if (options.signal.aborted) break;
    options.onChunk(fallbackText.slice(i, i + 25), fallbackText.slice(0, i + 25));
    await new Promise(r => setTimeout(r, 15));
  }

  return { text: fallbackText, provider: 'OFFLINE // SHADOW-CACHE' };
}

