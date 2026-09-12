"use client";

import { useState } from "react";
import { Sparkles, ArrowLeft, ArrowRight, RefreshCcw, ShieldCheck } from "lucide-react";
import { CameraCapture } from "@/components/camera-capture";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { api, ApiError } from "@/lib/api";

type Step = "quiz" | "capture" | "loading" | "results" | "error";

const SKIN_TYPES = [
  { value: "OILY", label: "Oily" },
  { value: "DRY", label: "Dry" },
  { value: "COMBINATION", label: "Combination" },
  { value: "NORMAL", label: "Normal" },
  { value: "SENSITIVE", label: "Sensitive" },
  { value: "UNSURE", label: "Not sure" },
];

const CONCERNS = [
  { value: "ACNE", label: "Acne & breakouts" },
  { value: "DARK_SPOTS", label: "Dark spots" },
  { value: "WRINKLES", label: "Fine lines & wrinkles" },
  { value: "DULLNESS", label: "Dullness" },
  { value: "LARGE_PORES", label: "Large pores" },
  { value: "REDNESS", label: "Redness" },
  { value: "DRYNESS", label: "Dryness" },
  { value: "OILINESS", label: "Excess oil" },
  { value: "UNEVEN_TONE", label: "Uneven tone" },
  { value: "SENSITIVITY", label: "Sensitivity" },
];

const AGE_RANGES = [
  { value: "UNDER_18", label: "Under 18" },
  { value: "18_24", label: "18–24" },
  { value: "25_34", label: "25–34" },
  { value: "35_44", label: "35–44" },
  { value: "45_PLUS", label: "45+" },
];

const CATEGORIES = [
  { value: "SKINCARE", label: "Skincare" },
  { value: "MAKEUP", label: "Makeup" },
  { value: "BOTH", label: "Both" },
];

const BUDGETS = [
  { value: "ANY", label: "No limit" },
  { value: "UNDER_1000", label: "Under Rs. 1,000" },
  { value: "UNDER_2500", label: "Under Rs. 2,500" },
  { value: "UNDER_5000", label: "Under Rs. 5,000" },
];

interface Answers {
  skinType: string;
  concerns: string[];
  ageRange: string;
  category: string;
  budget: string;
}

interface AnalysisResult {
  skinType: string;
  concerns: { name: string; severity: number }[];
  summary: string;
  tips: string[];
  recommendations: { reason: string; product: ProductCardData }[];
}

const initialAnswers: Answers = { skinType: "", concerns: [], ageRange: "", category: "BOTH", budget: "ANY" };

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        selected ? "border-brand bg-brand/10 text-brand" : "border-ink/15 text-ink/70 hover:border-ink/30"
      }`}
    >
      {children}
    </button>
  );
}

export default function SkinAnalysisPage() {
  const [step, setStep] = useState<Step>("quiz");
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canContinue = Boolean(answers.skinType && answers.ageRange);

  function toggleConcern(value: string) {
    setAnswers((a) => ({
      ...a,
      concerns: a.concerns.includes(value) ? a.concerns.filter((c) => c !== value) : a.concerns.length >= 6 ? a.concerns : [...a.concerns, value],
    }));
  }

  async function handleCapture(dataUrl: string) {
    setStep("loading");
    setError(null);
    try {
      const res = await api.post<AnalysisResult>("/api/beauty/analyze", { image: dataUrl, answers });
      setResult(res);
      setStep("results");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong while analyzing your photo.");
      setStep("error");
    }
  }

  function restart() {
    setAnswers(initialAnswers);
    setResult(null);
    setError(null);
    setStep("quiz");
  }

  return (
    <div className="container-x max-w-3xl py-10">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          <Sparkles size={13} /> AI Skin Analysis
        </span>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">Find products made for your skin</h1>
        <p className="mt-2 text-sm text-ink/60">Answer a few questions, take a quick selfie, and get personalized recommendations from our catalog.</p>
      </div>

      {step === "quiz" && (
        <div className="card mt-8 space-y-8 p-6 sm:p-8">
          <div>
            <p className="label mb-2">What's your skin type?</p>
            <div className="flex flex-wrap gap-2">
              {SKIN_TYPES.map((o) => (
                <Chip key={o.value} selected={answers.skinType === o.value} onClick={() => setAnswers((a) => ({ ...a, skinType: o.value }))}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="label mb-2">Any concerns you'd like to address? (up to 6)</p>
            <div className="flex flex-wrap gap-2">
              {CONCERNS.map((o) => (
                <Chip key={o.value} selected={answers.concerns.includes(o.value)} onClick={() => toggleConcern(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="label mb-2">Age range</p>
            <div className="flex flex-wrap gap-2">
              {AGE_RANGES.map((o) => (
                <Chip key={o.value} selected={answers.ageRange === o.value} onClick={() => setAnswers((a) => ({ ...a, ageRange: o.value }))}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <p className="label mb-2">Looking for</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((o) => (
                  <Chip key={o.value} selected={answers.category === o.value} onClick={() => setAnswers((a) => ({ ...a, category: o.value }))}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="label mb-2">Budget per item</p>
              <div className="flex flex-wrap gap-2">
                {BUDGETS.map((o) => (
                  <Chip key={o.value} selected={answers.budget === o.value} onClick={() => setAnswers((a) => ({ ...a, budget: o.value }))}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <button type="button" disabled={!canContinue} onClick={() => setStep("capture")} className="btn-primary w-full disabled:opacity-40">
            Continue to Photo <ArrowRight size={16} />
          </button>
        </div>
      )}

      {step === "capture" && (
        <div className="card mt-8 p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <button type="button" onClick={() => setStep("quiz")} className="flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
              <ArrowLeft size={14} /> Back
            </button>
            <p className="flex items-center gap-1.5 text-xs text-ink/40">
              <ShieldCheck size={13} /> Your photo is analyzed once and never stored.
            </p>
          </div>
          <p className="mb-4 text-center text-sm text-ink/60">Look straight at the camera in good, even lighting for the most accurate analysis.</p>
          <CameraCapture onCapture={handleCapture} />
        </div>
      )}

      {step === "loading" && (
        <div className="card mt-8 flex flex-col items-center gap-4 p-16 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="font-display text-lg">Analyzing your skin…</p>
          <p className="text-sm text-ink/50">Our AI is reviewing your photo and matching products from our catalog.</p>
        </div>
      )}

      {step === "error" && (
        <div className="card mt-8 flex flex-col items-center gap-4 p-12 text-center">
          <p className="font-display text-lg">We couldn't complete your analysis</p>
          <p className="max-w-sm text-sm text-ink/60">{error}</p>
          <button type="button" onClick={() => setStep("capture")} className="btn-primary">
            <RefreshCcw size={15} /> Try Again
          </button>
        </div>
      )}

      {step === "results" && result && (
        <div className="mt-8 space-y-8">
          <div className="card p-6 sm:p-8">
            <span className="badge bg-brand/10 text-brand">Detected skin type: {result.skinType}</span>
            <p className="mt-4 text-ink/80">{result.summary}</p>

            {result.concerns.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="label">Key concerns</p>
                {result.concerns.map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs text-ink/60">
                      <span>{c.name}</span>
                      <span>{c.severity}/5</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10">
                      <div className="h-1.5 rounded-full bg-brand" style={{ width: `${(Math.min(5, Math.max(1, c.severity)) / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.tips.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {result.tips.map((tip, i) => (
                  <div key={i} className="rounded-xl bg-blush p-4 text-sm text-ink/70">
                    {tip}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display text-xl">Recommended for you</h2>
            {result.recommendations.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">No matching products found — try adjusting your budget or category preference.</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3">
                {result.recommendations.map((r) => (
                  <div key={r.product.id}>
                    <ProductCard product={r.product} />
                    {r.reason && <p className="mt-1.5 text-xs text-ink/50">{r.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center">
            <button type="button" onClick={restart} className="btn-outline">
              <RefreshCcw size={15} /> Retake Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
