"use client";

import DocumentWorkspace from "./documents";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  FileText,
  FlaskConical,
  History,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Upload,
  Waves,
  X,
} from "lucide-react";

type Applicant = {
  name: string;
  kind: "worker" | "business";
  purpose: string;
  requested_amount: number;
  tenure_months: number;
  household_expenses: number;
  monthly_obligations: number;
};
type Policy = {
  revenue_shock: number;
  expense_shock: number;
  capacity_share: number;
  annual_rate: number;
  minimum_months: number;
};
type Transaction = {
  transaction_id: string;
  date: string;
  amount: number;
  balance: number | null;
  description: string;
  category: string;
};
type RequestData = {
  applicant: Applicant;
  policy: Policy;
  transactions: Transaction[];
  period_start: string;
  period_end: string;
  simulated: boolean;
  previous_assessment_id?: string | null;
};
type Monthly = {
  month: string;
  complete: boolean;
  income: number;
  operating_expenses: number;
  household_used: number;
  debt_used: number;
  surplus: number;
  stressed_surplus: number;
  count: number;
};
type Assessment = {
  id: string;
  inputs: RequestData;
  created_at: string;
  engine_version: string;
  input_hash: string;
  status: string;
  simulated: boolean;
  applicant: Applicant;
  policy: Policy;
  period_start: string;
  period_end: string;
  default_probability: null;
  risk_note: string;
  previous_assessment_id: string | null;
  monthly: Monthly[];
  flags: {
    code: string;
    severity: string;
    message: string;
    transaction_ids?: string[];
  }[];
  reasons: { code: string; text: string }[];
  metrics: {
    complete_months: number;
    transaction_count: number;
    duplicates_removed: number;
    total_inflows: number;
    total_outflows: number;
    median_income: number;
    median_surplus: number;
    stressed_surplus: number;
    income_volatility: number | null;
    minimum_observed_balance: number | null;
    closing_balance: number | null;
    buffer_months: number | null;
    monthly_capacity: number;
    requested_instalment: number;
    maximum_affordable_principal: number;
  };
};
type Scenario = Applicant & { id: string; subtitle: string };
type Metric = "roc_auc" | "pr_auc" | "brier";
type ModelResult = {
  id: string;
  model: string;
  feature_set: string;
  features: string[];
  validation_auc: number;
  metrics: Record<Metric, number>;
  confidence_intervals: Record<Metric, number[]>;
  calibration: { predicted: number; observed: number }[];
  policy_points: {
    target_approval: number;
    validation_threshold: number;
    test_approval: number;
    test_adverse_rate: number;
    adverse_rate_ci: number[];
    approved_count: number;
    matched_volume_adverse_rate: number;
    matched_volume_count: number;
  }[];
  samples: {
    borrower_id: string;
    actual_outcome: number;
    probability: number;
    contributions: { feature: string; value: number; contribution: number }[];
  }[];
};
type Benchmark = {
  status: string;
  message?: string;
  dataset: string;
  target: string;
  source_page: string;
  license: string;
  attribution: string;
  created_at: string;
  split_method: string;
  selection: string;
  selected_model: string;
  limitations: string[];
  bootstrap_rounds: number;
  source_sha256: string;
  audit: Record<string, number>;
  results: ModelResult[];
};

const money = (n: number | null, digits = 0) =>
  n === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        maximumFractionDigits: digits,
      }).format(n);
const pct = (n: number | null) =>
  n === null ? "Unavailable" : `${(n * 100).toFixed(1)}%`;
const statuses: Record<string, string> = {
  WITHIN_CAPACITY: "Within demo capacity",
  EXCEEDS_CAPACITY: "Exceeds demo capacity",
  REFER: "Review evidence",
  INSUFFICIENT_DATA: "Insufficient evidence",
};
const policyDefaults: Policy = {
  revenue_shock: 0.2,
  expense_shock: 0.1,
  capacity_share: 0.5,
  annual_rate: 0.12,
  minimum_months: 6,
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({
        detail:
          "Service unavailable. Check that the assessment service is running.",
      }));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check the form values and transaction fields.",
    );
  }
  return res.json();
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [tab, setTab] = useState("assessments");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState("worker");
  const [draft, setDraft] = useState<RequestData | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [previous, setPrevious] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<Assessment[]>([]);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [modelId, setModelId] = useState("");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<"profile" | "policy" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [extended, setExtended] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Scenario[]>("/api/scenarios"),
      api<RequestData>("/api/scenarios/worker"),
      api<Assessment[]>("/api/assessments"),
    ])
      .then(([s, d, h]) => {
        if (active) {
          setScenarios(s);
          setDraft(d);
          setHistory(h);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function loadScenario(id: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setDraft(await api<RequestData>(`/api/scenarios/${id}`));
      setSelected(id);
      setAssessment(null);
      setPrevious(null);
      setExtended(false);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function run(data = draft) {
    if (!data) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<Assessment>("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setAssessment(result);
      setDraft({ ...data, previous_assessment_id: result.id });
      setDirty(false);
      setHistory(await api("/api/assessments"));
      setPanel(null);
      setMessage("Assessment saved with its inputs and policy settings.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addMonth() {
    if (!draft || !assessment) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<RequestData>(
        `/api/scenarios/${selected}?extended=true`,
      );
      next.applicant = draft.applicant;
      next.policy = draft.policy;
      next.previous_assessment_id = assessment.id;
      setPrevious(assessment);
      setDraft(next);
      setExtended(true);
      setDirty(true);
      await run(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File) {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", f);
      const parsed = await api<{
        transactions: Transaction[];
        earliest: string;
        latest: string;
      }>("/api/transactions/parse", { method: "POST", body: form });
      setDraft({
        ...draft,
        transactions: parsed.transactions,
        period_start: parsed.earliest,
        period_end: parsed.latest,
        simulated: false,
        previous_assessment_id: assessment?.id || null,
      });
      setDirty(true);
      setPanel("profile");
      setMessage(
        "CSV parsed. Confirm statement coverage, applicant details and whether these records are simulated, then assess.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function openBenchmark() {
    setTab("benchmark");
    setError("");
    try {
      const b = await api<Benchmark>("/api/benchmark");
      setBenchmark(b);
      if (b.status === "complete") setModelId(b.selected_model);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function openHistory(id: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Assessment>(`/api/assessments/${id}`);
      setAssessment(result);
      setDraft({ ...result.inputs, previous_assessment_id: result.id });
      setSelected("");
      setPrevious(null);
      setTab("assessments");
      setDirty(false);
      setMessage(
        "Saved assessment opened with its exact inputs. Any reassessment will create a new linked record.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function newApplication() {
    setDraft({
      applicant: {
        name: "",
        kind: "worker",
        purpose: "",
        requested_amount: 5000,
        tenure_months: 12,
        household_expenses: 1500,
        monthly_obligations: 0,
      },
      policy: { ...policyDefaults },
      transactions: [],
      period_start: "2026-01-01",
      period_end: "2026-06-30",
      simulated: false,
    });
    setAssessment(null);
    setPrevious(null);
    setSelected("");
    setPanel("profile");
    setTab("assessments");
    setDirty(true);
    setMessage(
      "Add applicant details and upload a single-account MYR transaction CSV.",
    );
  }
  const a = assessment;
  const applicant = draft?.applicant || a?.applicant;
  const result = benchmark?.results?.find((r) => r.id === modelId);
  const sample = result?.samples[sampleIndex];
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Arus home">
          <Waves size={34} />
          <span>
            arus<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-mark">MY</span>
          <div>
            Malaysia workspace<small>Underwriting research</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <button
            className={tab === "assessments" ? "active" : ""}
            onClick={() => setTab("assessments")}
          >
            <Layers size={18} />
            Assessments
            <ChevronRight size={15} />
          </button>
          <button
            className={tab === "documents" ? "active" : ""}
            onClick={() => setTab("documents")}
          >
            <Upload size={18} />
            Document intake
          </button>
          <button
            className={tab === "benchmark" ? "active" : ""}
            onClick={openBenchmark}
          >
            <FlaskConical size={18} />
            Model benchmark
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            <History size={18} />
            Assessment history
            <span className="nav-count">{history.length}</span>
          </button>
          <button
            className={tab === "guide" ? "active" : ""}
            onClick={() => setTab("guide")}
          >
            <FileText size={18} />
            Data & methodology
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" />
          LOCAL PROTOTYPE
          <p>
            More financial context.
            <br />
            More informed decisions.
          </p>
          <small>
            Demonstration policies.
            <br />
            No automated loan approvals.
          </small>
        </div>
        <div className="profile-avatar">
          <span>LA</span>
          <div>
            Lender analyst<small>Research workspace</small>
          </div>
          <ShieldCheck size={17} />
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <ChevronRight size={13} />
            <span>
              {tab === "documents"
                ? "Document intake"
                : tab === "benchmark"
                  ? "Model benchmark"
                  : tab === "history"
                    ? "Assessment history"
                    : tab === "guide"
                      ? "Data & methodology"
                      : "Assessments"}
            </span>
          </div>
          <span className="prototype">
            <span />
            Prototype · MYR
          </span>
        </header>
        <main id="main">
          {error && (
            <div role="alert" className="notice error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {message && (
            <div role="status" className="notice">
              <Check size={16} />
              {message}
              <button
                aria-label="Dismiss message"
                onClick={() => setMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "documents" && (
            <DocumentWorkspace
              onAssessment={(value) => {
                const result = value as Assessment;
                setAssessment(result);
                setDraft({
                  ...result.inputs,
                  previous_assessment_id: result.id,
                });
                setSelected("");
                setPrevious(null);
                setDirty(false);
                setTab("assessments");
                api<Assessment[]>("/api/assessments").then(setHistory);
                setMessage(
                  "Reviewed document assessment saved locally. Supporting documents are retained separately from cash-flow totals.",
                );
              }}
            />
          )}
          {tab === "assessments" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">CASH-FLOW ASSESSMENT</p>
                  <h1>See the full picture.</h1>
                  <p>Understand the economic activity behind an application.</p>
                </div>
                <button
                  className="primary"
                  onClick={newApplication}
                  disabled={busy}
                >
                  <Plus size={17} />
                  New application
                </button>
              </div>
              <div className="demo-strip">
                <span className="demo-label">TRY A DEMONSTRATION</span>
                <div>
                  {scenarios.map((s) => (
                    <button
                      disabled={busy}
                      onClick={() => loadScenario(s.id)}
                      className={selected === s.id ? "selected" : ""}
                      key={s.id}
                    >
                      {s.id === "worker"
                        ? "Irregular-income worker"
                        : s.id === "business"
                          ? "Seasonal microbusiness"
                          : "Limited history"}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
              {!applicant ? (
                <div className="empty">
                  <LoaderCircle className="spin" />
                  Loading the local assessment service…
                </div>
              ) : (
                <>
                  <section className="applicant-heading">
                    <div className="initials">
                      {applicant.name
                        ? applicant.name
                            .split(" ")
                            .slice(0, 2)
                            .map((s) => s[0])
                            .join("")
                        : "+"}
                    </div>
                    <div>
                      <div className="name-line">
                        <h2>{applicant.name || "New applicant"}</h2>
                        <span className="tag">
                          {(draft?.simulated ?? a?.simulated)
                            ? "Simulated records"
                            : "User-supplied records"}
                        </span>
                      </div>
                      <p>
                        {applicant.kind === "worker"
                          ? "Independent worker"
                          : "Microbusiness"}
                        <span className="dot-separator">·</span>
                        {applicant.purpose || "Add financing purpose"}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      disabled={!draft || busy}
                      onClick={() =>
                        setPanel(panel === "profile" ? null : "profile")
                      }
                    >
                      Application details
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                  {panel && draft && (
                    <section className="edit-panel">
                      <div className="section-heading">
                        <h3>
                          {panel === "profile"
                            ? "Application & statement coverage"
                            : "Demonstration policy"}
                        </h3>
                        <button
                          className="icon-button"
                          aria-label="Close editor"
                          onClick={() => setPanel(null)}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <p className="muted">
                        {panel === "profile"
                          ? "One account, MYR only. Dates describe the statement coverage, not just the first and last transaction."
                          : "These are editable research assumptions, not a Malaysian lender’s approved policy."}
                      </p>
                      <div className="form-grid">
                        {panel === "profile" ? (
                          <>
                            <label>
                              Applicant name
                              <input
                                value={draft.applicant.name}
                                maxLength={100}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    applicant: {
                                      ...draft.applicant,
                                      name: e.target.value,
                                    },
                                  });
                                  setDirty(true);
                                }}
                              />
                            </label>
                            <label>
                              Applicant type
                              <select
                                value={draft.applicant.kind}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    applicant: {
                                      ...draft.applicant,
                                      kind: e.target.value as Applicant["kind"],
                                    },
                                  });
                                  setDirty(true);
                                }}
                              >
                                <option value="worker">
                                  Worker / freelancer
                                </option>
                                <option value="business">Microbusiness</option>
                              </select>
                            </label>
                            <label className="span-2">
                              Financing purpose
                              <input
                                value={draft.applicant.purpose}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    applicant: {
                                      ...draft.applicant,
                                      purpose: e.target.value,
                                    },
                                  });
                                  setDirty(true);
                                }}
                              />
                            </label>
                            {(
                              [
                                ["requested_amount", "Requested amount (RM)"],
                                ["tenure_months", "Tenure (months)"],
                                [
                                  "household_expenses",
                                  draft.applicant.kind === "business"
                                    ? "Owner household draw (RM/month)"
                                    : "Household needs (RM/month)",
                                ],
                                [
                                  "monthly_obligations",
                                  "Existing debt (RM/month)",
                                ],
                              ] as const
                            ).map(([key, label]) => (
                              <label key={key}>
                                {label}
                                <input
                                  type="number"
                                  min={key === "tenure_months" ? 1 : 0}
                                  value={draft.applicant[key]}
                                  onChange={(e) => {
                                    setDraft({
                                      ...draft,
                                      applicant: {
                                        ...draft.applicant,
                                        [key]: Number(e.target.value),
                                      },
                                    });
                                    setDirty(true);
                                  }}
                                />
                              </label>
                            ))}
                            <label>
                              Statement starts
                              <input
                                type="date"
                                value={draft.period_start}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    period_start: e.target.value,
                                  });
                                  setDirty(true);
                                }}
                              />
                            </label>
                            <label>
                              Statement ends
                              <input
                                type="date"
                                value={draft.period_end}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    period_end: e.target.value,
                                  });
                                  setDirty(true);
                                }}
                              />
                            </label>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={draft.simulated}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    simulated: e.target.checked,
                                  });
                                  setDirty(true);
                                }}
                              />
                              These are simulated demonstration records
                            </label>
                          </>
                        ) : (
                          <>
                            {(
                              [
                                ["revenue_shock", "Income reduction (%)"],
                                ["expense_shock", "Expense increase (%)"],
                                [
                                  "capacity_share",
                                  "Share of stressed surplus (%)",
                                ],
                                [
                                  "annual_rate",
                                  "Illustrative annual interest (%)",
                                ],
                              ] as const
                            ).map(([key, label]) => (
                              <label key={key}>
                                {label}
                                <input
                                  type="number"
                                  min={key === "capacity_share" ? 1 : 0}
                                  max={key === "revenue_shock" ? 90 : 100}
                                  value={Math.round(draft.policy[key] * 100)}
                                  onChange={(e) => {
                                    setDraft({
                                      ...draft,
                                      policy: {
                                        ...draft.policy,
                                        [key]: Number(e.target.value) / 100,
                                      },
                                    });
                                    setDirty(true);
                                  }}
                                />
                              </label>
                            ))}
                            <label>
                              Minimum complete months
                              <input
                                type="number"
                                min={3}
                                max={24}
                                value={draft.policy.minimum_months}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    policy: {
                                      ...draft.policy,
                                      minimum_months: Number(e.target.value),
                                    },
                                  });
                                  setDirty(true);
                                }}
                              />
                            </label>
                          </>
                        )}
                      </div>
                      <button
                        className="primary"
                        disabled={busy || !draft.transactions.length}
                        onClick={() => run()}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                        Save & assess
                      </button>
                    </section>
                  )}
                  <div className="toolbar">
                    <div>
                      <span className="evidence-dot" />
                      {draft
                        ? `${draft.transactions.length} transactions ready`
                        : `${a?.metrics.transaction_count} transactions assessed`}
                      <span className="dot-separator">·</span>
                      <span className="coverage">
                        {draft?.period_start || a?.period_start} —{" "}
                        {draft?.period_end || a?.period_end}
                      </span>
                    </div>
                    <div>
                      <input
                        ref={file}
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        aria-label="Upload transaction CSV"
                        onChange={(e) => {
                          if (e.target.files?.[0]) upload(e.target.files[0]);
                        }}
                      />
                      <button
                        disabled={busy || !draft}
                        className="secondary"
                        onClick={() => file.current?.click()}
                      >
                        <Upload size={15} />
                        Upload CSV
                      </button>
                      <button
                        className="secondary"
                        disabled={busy || !draft}
                        onClick={() =>
                          setPanel(panel === "policy" ? null : "policy")
                        }
                      >
                        <Settings2 size={15} />
                        Policy
                      </button>
                      <button
                        className="primary"
                        disabled={busy || !draft || !draft.transactions.length}
                        onClick={() => run()}
                      >
                        {busy ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <ArrowRight size={16} />
                        )}{" "}
                        {a ? "Reassess" : "Run assessment"}
                      </button>
                    </div>
                  </div>
                  {dirty && a && (
                    <div className="notice warning">
                      Inputs have changed. Results below belong to the previous
                      saved assessment. Run reassessment to update them.
                    </div>
                  )}
                  {!a ? (
                    <div className="start-state">
                      <div>
                        <p className="eyebrow">EVIDENCE BEFORE A SCORE</p>
                        <h2>
                          A clearer view of
                          <br />
                          repayment capacity.
                        </h2>
                        <p>
                          Assess income consistency, household needs and
                          obligations together. Every assumption stays visible.
                        </p>
                        <button
                          className="primary"
                          onClick={() => run()}
                          disabled={busy || !draft?.transactions.length}
                        >
                          Assess this application
                          <ArrowRight size={16} />
                        </button>
                      </div>
                      <div className="start-ledger">
                        <div>
                          <span>01</span>
                          <h3>Understand the cash flow</h3>
                          <p>Recognised income, costs and liquidity.</p>
                        </div>
                        <div>
                          <span>02</span>
                          <h3>Test repayment capacity</h3>
                          <p>Allow for lower income and higher costs.</p>
                        </div>
                        <div>
                          <span>03</span>
                          <h3>Inspect the evidence</h3>
                          <p>Reasons, gaps and the next step.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <section className="decision-row">
                        <div>
                          <p className="eyebrow">ASSESSMENT OUTCOME</p>
                          <h2>{statuses[a.status]}</h2>
                          <p>
                            {a.status === "WITHIN_CAPACITY"
                              ? "The requested repayment fits the demonstration stress assumptions."
                              : a.status === "INSUFFICIENT_DATA"
                                ? "More complete transaction history is needed before assessing capacity."
                                : a.status === "REFER"
                                  ? "Resolve the highlighted evidence gaps before relying on this assessment."
                                  : "The requested repayment exceeds the calculated demonstration capacity."}
                          </p>
                        </div>
                        <div className="decision-stamp">
                          <ShieldCheck size={24} />
                          <span>
                            Decision support<small>Not a credit approval</small>
                          </span>
                        </div>
                      </section>
                      <div className="metrics-row">
                        <div>
                          <span>Median monthly income</span>
                          <strong>{money(a.metrics.median_income)}</strong>
                          <small>Recognised inflows · complete months</small>
                        </div>
                        <div>
                          <span>Monthly repayment capacity</span>
                          <strong>{money(a.metrics.monthly_capacity)}</strong>
                          <small>
                            After stress, living costs & existing debt
                          </small>
                        </div>
                        <div>
                          <span>Requested repayment</span>
                          <strong>
                            {money(a.metrics.requested_instalment)}
                          </strong>
                          <small>
                            {money(a.applicant.requested_amount)} over{" "}
                            {a.applicant.tenure_months} months
                          </small>
                        </div>
                        <div>
                          <span>History available</span>
                          <strong>
                            {a.metrics.complete_months}
                            <em> months</em>
                          </strong>
                          <small>
                            {a.policy.minimum_months} complete months required
                          </small>
                        </div>
                      </div>
                      <div className="analysis-grid">
                        <section className="chart-section">
                          <div className="section-heading">
                            <div>
                              <h3>The cash-flow picture</h3>
                              <p>Recognised income and costs, by month</p>
                            </div>
                            <span className="tag subtle">MYR</span>
                          </div>
                          <CashChart monthly={a.monthly} />
                          <div className="chart-legend">
                            <span>
                              <i />
                              Income
                            </span>
                            <span>
                              <i />
                              Costs + household + debt
                            </span>
                            <span>Partial months excluded from capacity</span>
                          </div>
                        </section>
                        <section className="capacity-section">
                          <p className="eyebrow">STRESS-TESTED CAPACITY</p>
                          <h3>Room to repay.</h3>
                          {["REFER", "INSUFFICIENT_DATA"].includes(
                            a.status,
                          ) && (
                            <span className="tag">
                              Provisional · evidence incomplete
                            </span>
                          )}
                          <div className="capacity-number">
                            {money(a.metrics.maximum_affordable_principal)}
                            <small>Illustrative affordable principal</small>
                          </div>
                          <dl>
                            <div>
                              <dt>Median operating surplus*</dt>
                              <dd>{money(a.metrics.median_surplus)}</dd>
                            </div>
                            <div>
                              <dt>Median stressed surplus</dt>
                              <dd>{money(a.metrics.stressed_surplus)}</dd>
                            </div>
                            <div>
                              <dt>Available for new repayment</dt>
                              <dd>{pct(a.policy.capacity_share)}</dd>
                            </div>
                            <div>
                              <dt>Observed balance buffer</dt>
                              <dd>
                                {a.metrics.buffer_months === null
                                  ? "Unavailable"
                                  : `${a.metrics.buffer_months.toFixed(1)} months`}
                              </dd>
                            </div>
                          </dl>
                          <p className="footnote">
                            *After household needs and existing debt. Capacity
                            is a policy calculation, not a credit limit or
                            offer.
                          </p>
                        </section>
                      </div>
                      {previous && (
                        <div className="comparison">
                          <RefreshCw size={20} />
                          <div>
                            <h3>One more month. A fresh assessment.</h3>
                            <p>
                              Monthly capacity:{" "}
                              {money(previous.metrics.monthly_capacity)} →{" "}
                              <strong>
                                {money(a.metrics.monthly_capacity)}
                              </strong>
                              . Complete history:{" "}
                              {previous.metrics.complete_months} →{" "}
                              {a.metrics.complete_months} months.
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="evidence-grid">
                        <section>
                          <div className="section-heading">
                            <h3>Evidence & review points</h3>
                            <span className="tag subtle">
                              {a.flags.length} flags
                            </span>
                          </div>
                          {a.flags.length ? (
                            a.flags.map((f) => (
                              <div
                                className={`flag ${f.severity}`}
                                key={f.code}
                              >
                                <span className="flag-dot" />
                                <div>
                                  <strong>
                                    {f.code.toLowerCase().replaceAll("_", " ")}
                                  </strong>
                                  <p>{f.message}</p>
                                  {f.transaction_ids && (
                                    <details>
                                      <summary>Transaction references</summary>
                                      <small>
                                        {f.transaction_ids.join(", ")}
                                      </small>
                                    </details>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="clear-state">
                              <Check size={20} />
                              <div>
                                <strong>No automated evidence flags</strong>
                                <p>
                                  Categories and statement coverage still
                                  require analyst verification.
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="unavailable">
                            <ShieldCheck size={17} />
                            <div>
                              <strong>Default probability · Unavailable</strong>
                              <p>{a.risk_note}</p>
                            </div>
                          </div>
                        </section>
                        <section>
                          <h3>Why this assessment?</h3>
                          <ol className="reasons">
                            {a.reasons.slice(0, 5).map((r) => (
                              <li key={r.code}>{r.text}</li>
                            ))}
                          </ol>
                        </section>
                      </div>
                      <details className="ledger">
                        <summary>
                          Monthly calculations & audit trail
                          <span>Inspect underlying evidence</span>
                        </summary>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Month</th>
                                <th>Income</th>
                                <th>Operating costs</th>
                                <th>Household</th>
                                <th>Debt</th>
                                <th>Surplus</th>
                                <th>Stressed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.monthly.map((m) => (
                                <tr key={m.month}>
                                  <td>
                                    {m.month}
                                    {!m.complete ? " (partial)" : ""}
                                  </td>
                                  <td>{money(m.income)}</td>
                                  <td>{money(m.operating_expenses)}</td>
                                  <td>{money(m.household_used)}</td>
                                  <td>{money(m.debt_used)}</td>
                                  <td>{money(m.surplus)}</td>
                                  <td>{money(m.stressed_surplus)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p>
                          Total raw inflows: {money(a.metrics.total_inflows)} ·
                          Total raw outflows: {money(a.metrics.total_outflows)}{" "}
                          · Removed duplicates: {a.metrics.duplicates_removed}
                        </p>
                        <p className="footnote">{a.reasons[5].text}</p>
                        <p className="hash">
                          Saved {new Date(a.created_at).toLocaleString()} ·
                          Engine {a.engine_version}
                          <br />
                          Input SHA-256: {a.input_hash}
                          <br />
                          Assessment: {a.id}
                        </p>
                      </details>
                      <details className="ledger">
                        <summary>
                          Original transaction evidence
                          <span>Exact saved inputs</span>
                        </summary>
                        <p>
                          Showing up to 100 original rows. Export the assessment
                          for the complete input snapshot.
                        </p>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.inputs?.transactions
                                .slice(0, 100)
                                .map((t, i) => (
                                  <tr key={i}>
                                    <td>{t.transaction_id}</td>
                                    <td>{t.date}</td>
                                    <td>{t.description}</td>
                                    <td>{t.category}</td>
                                    <td>{money(t.amount, 2)}</td>
                                    <td>{money(t.balance, 2)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      <div className="bottom-actions">
                        <p>
                          <span className="live-dot" />
                          Saved locally ·{" "}
                          {a.simulated
                            ? "Simulated records"
                            : "User-supplied records"}
                        </p>
                        <div>
                          {selected && draft?.simulated && !extended && (
                            <button
                              className="secondary"
                              disabled={busy || dirty}
                              onClick={addMonth}
                            >
                              <Plus size={15} />
                              Add next demo month
                            </button>
                          )}
                          <button
                            className="secondary"
                            onClick={() =>
                              download(`arus-assessment-${a.id}.json`, a)
                            }
                          >
                            <Download size={15} />
                            Export assessment
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
          {tab === "benchmark" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">REAL DATA · REPRODUCIBLE RESEARCH</p>
                  <h1>Evidence, measured.</h1>
                  <p>
                    Public-data model performance, separate from Malaysian
                    assessments.
                  </p>
                </div>
                <button className="secondary" onClick={openBenchmark}>
                  <RefreshCw size={16} />
                  Refresh results
                </button>
              </div>
              {!benchmark ? (
                <div className="empty">Loading benchmark…</div>
              ) : benchmark.status !== "complete" ? (
                <div className="start-state">
                  <div>
                    <h2>No results yet.</h2>
                    <p>{benchmark.message}</p>
                    <p>No placeholder performance numbers are shown.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="benchmark-banner">
                    <FlaskConical size={24} />
                    <div>
                      <h3>{benchmark.dataset}</h3>
                      <p>
                        {benchmark.audit.rows.toLocaleString()} clients ·{" "}
                        {benchmark.audit.test.toLocaleString()} held-out records
                        · {benchmark.license}
                      </p>
                      <p>{benchmark.target}</p>
                    </div>
                    <a
                      href={benchmark.source_page}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Original source
                      <ArrowUpRight size={16} />
                    </a>
                  </div>
                  <p className="method-note">{benchmark.split_method}</p>
                  <div className="section-heading">
                    <div>
                      <h3>Three models. Two evidence sets.</h3>
                      <p>
                        95% test-bootstrap intervals ·{" "}
                        {benchmark.bootstrap_rounds} resamples · lower Brier is
                        better
                      </p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table className="benchmark-table">
                      <thead>
                        <tr>
                          <th>Model / evidence</th>
                          <th>ROC-AUC ↑</th>
                          <th>PR-AUC ↑</th>
                          <th>Brier ↓</th>
                          <th>Explore</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmark.results.map((r) => (
                          <tr
                            key={r.id}
                            className={modelId === r.id ? "chosen" : ""}
                          >
                            <td>
                              <strong>{r.model}</strong>
                              <small>
                                {r.feature_set === "static"
                                  ? "Credit limit only"
                                  : "Credit limit + payment history"}
                                {r.id === benchmark.selected_model
                                  ? " · selected on validation"
                                  : ""}
                              </small>
                            </td>
                            {(["roc_auc", "pr_auc", "brier"] as Metric[]).map(
                              (k) => (
                                <td key={k}>
                                  {r.metrics[k].toFixed(3)}
                                  <small>
                                    {r.confidence_intervals[k]
                                      .map((n) => n.toFixed(3))
                                      .join(" – ")}
                                  </small>
                                </td>
                              ),
                            )}
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`Explore ${r.model} ${r.feature_set}`}
                                onClick={() => setModelId(r.id)}
                              >
                                <ArrowUpRight size={19} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result && (
                    <>
                      <div className="analysis-grid benchmark-analysis">
                        <section>
                          <div className="section-heading">
                            <div>
                              <h3>Calibration · {result.model}</h3>
                              <p>
                                {result.feature_set === "static"
                                  ? "Credit limit only"
                                  : "Credit limit + payment history"}
                              </p>
                            </div>
                          </div>
                          <Calibration points={result.calibration} />
                        </section>
                        <section className="policy-results">
                          <h3>Retrospective approval comparison</h3>
                          <p className="muted">
                            At matched approval volumes, observe actual adverse
                            outcomes. These are benchmark borrowers, not newly
                            approved Malaysian applicants.
                          </p>
                          <table>
                            <thead>
                              <tr>
                                <th>Approval volume</th>
                                <th>Borrowers</th>
                                <th>Adverse rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.policy_points.map((p) => (
                                <tr key={p.target_approval}>
                                  <td>{pct(p.target_approval)}</td>
                                  <td>
                                    {p.matched_volume_count.toLocaleString()}
                                  </td>
                                  <td>{pct(p.matched_volume_adverse_rate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <details>
                            <summary>Frozen validation thresholds</summary>
                            {result.policy_points.map((p) => (
                              <p key={p.target_approval}>
                                Threshold {pct(p.validation_threshold)} → test
                                approval {pct(p.test_approval)}, adverse rate{" "}
                                {pct(p.test_adverse_rate)} (95% interval{" "}
                                {p.adverse_rate_ci?.map(pct).join("–") ||
                                  "unavailable"}
                                ).
                              </p>
                            ))}
                          </details>
                        </section>
                      </div>
                      <section className="heldout">
                        <div className="section-heading">
                          <h3>A held-out borrower, explained</h3>
                          <label className="sample-select">
                            Public-data client
                            <select
                              aria-label="Public-data client"
                              value={sampleIndex}
                              onChange={(e) =>
                                setSampleIndex(Number(e.target.value))
                              }
                            >
                              {result.samples.map((s, i) => (
                                <option key={s.borrower_id} value={i}>
                                  {s.borrower_id}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <p className="muted">
                          Public-data client {sample!.borrower_id} · observed
                          outcome:{" "}
                          {sample!.actual_outcome
                            ? "default payment"
                            : "no default payment"}{" "}
                          · estimated probability: {pct(sample!.probability)}
                        </p>
                        <div className="contributions">
                          {sample!.contributions.map((c) => (
                            <div key={c.feature}>
                              <span>
                                {c.feature}
                                <small>Input {c.value.toLocaleString()}</small>
                              </span>
                              <div className="contribution-track">
                                <i
                                  style={{
                                    width: `${Math.min(100, Math.abs(c.contribution) * 70)}%`,
                                    background:
                                      c.contribution > 0
                                        ? "var(--terracotta)"
                                        : "var(--green)",
                                  }}
                                />
                              </div>
                              <strong>
                                {c.contribution > 0 ? "+" : ""}
                                {c.contribution.toFixed(3)}
                              </strong>
                            </div>
                          ))}
                        </div>
                        <p className="footnote">
                          Contributions explain the base model’s log odds.
                          Positive values increase model risk; they are not
                          causal effects or percentage-point changes in
                          calibrated probability.
                        </p>
                      </section>
                    </>
                  )}
                  <details className="ledger" open>
                    <summary>
                      What this benchmark can and cannot establish
                    </summary>
                    <ul>
                      {benchmark.limitations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                    <p>{benchmark.selection}</p>
                    <p className="footnote">{benchmark.attribution}</p>
                    <p className="hash">
                      Source SHA-256: {benchmark.source_sha256}
                    </p>
                  </details>
                  <button
                    className="secondary"
                    onClick={() => download("arus-benchmark.json", benchmark)}
                  >
                    <Download size={16} />
                    Export complete benchmark
                  </button>
                </>
              )}
            </>
          )}
          {tab === "history" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">LOCAL AUDIT TRAIL</p>
                  <h1>Every assessment, traceable.</h1>
                  <p>
                    Saved results preserve their policy, reasons and input
                    fingerprint.
                  </p>
                </div>
              </div>
              {!history.length ? (
                <div className="empty">
                  Run an assessment to start your audit trail.
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Applicant</th>
                        <th>Outcome</th>
                        <th>Evidence</th>
                        <th>Saved</th>
                        <th>Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <strong>{h.applicant.name}</strong>
                            <small>
                              {h.previous_assessment_id
                                ? "Reassessment"
                                : "Initial assessment"}{" "}
                              · {h.id.slice(0, 8)}
                            </small>
                          </td>
                          <td>{statuses[h.status]}</td>
                          <td>{h.simulated ? "Simulated" : "User supplied"}</td>
                          <td>{new Date(h.created_at).toLocaleString()}</td>
                          <td>
                            <button
                              className="icon-button"
                              disabled={busy}
                              aria-label={`Open assessment ${h.id}`}
                              onClick={() => openHistory(h.id)}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {tab === "guide" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">READ THE EVIDENCE CORRECTLY</p>
                  <h1>Built on clear boundaries.</h1>
                  <p>What goes in, what comes out, and what remains unknown.</p>
                </div>
              </div>
              <div className="guide-grid">
                <section>
                  <span className="guide-number">01</span>
                  <h2>Malaysian cash flow</h2>
                  <p>
                    A deterministic affordability assessment for one MYR
                    account. Worker living costs and business-owner household
                    needs are protected before calculating repayment capacity.
                  </p>
                  <p>
                    Confirmed transfers are excluded. Unknown inflows do not
                    count as income. Unknown outflows remain costs. Complete
                    inactive months count as zero activity.
                  </p>
                  <p>
                    Income reduction, expense increase, surplus allocation and
                    reducing-balance interest are visible demonstration
                    settings.
                  </p>
                </section>
                <section>
                  <span className="guide-number">02</span>
                  <h2>Public-data credit research</h2>
                  <p>
                    Taiwan’s openly licensed credit-card dataset is the
                    implemented fallback while Home Credit reuse permissions
                    remain unconfirmed. Models never consume Malaysian demo
                    transactions.
                  </p>
                  <p>
                    No country transfer is assumed. No synthetic borrowers are
                    included in training, validation or testing.
                  </p>
                  <button className="text-button" onClick={openBenchmark}>
                    Inspect measured results
                    <ArrowRight size={16} />
                  </button>
                </section>
              </div>
              <section className="csv-guide">
                <h3>Transaction CSV contract</h3>
                <p>
                  UTF-8, comma-separated, maximum 5 MB / 20,000 rows. One
                  account, amounts in MYR, positive inflows and negative
                  outflows. Balance may be blank. Same-day rows must be ordered
                  chronologically by transaction ID.
                </p>
                <code>
                  transaction_id,date,amount,balance,description,category
                </code>
                <p>
                  Dates: YYYY-MM-DD. Categories: income, expense, household,
                  debt, transfer, unknown. Income excludes financing proceeds,
                  own-account transfers and unverified credits. Use expense for
                  refunds. Confirm the full statement period after uploading.
                </p>
                <a className="secondary" href="/api/scenarios/worker/csv">
                  <Download size={16} />
                  Download simulated example
                </a>
              </section>
              <section className="unavailable">
                <ShieldCheck />
                <div>
                  <h3>A recommendation is not a loan offer.</h3>
                  <p>
                    No validated Malaysian default probability, credit-risk
                    band, fraud probability or identity verification is
                    available. A scenario can fit affordability assumptions
                    while still being unsuitable for credit. This local
                    prototype has no authentication. Personal document
                    processing is local-only; use synthetic records for public
                    presentations.
                  </p>
                </div>
              </section>
            </>
          )}
          <footer>
            <span className="footer-brand">arus.</span>
            <span>Economic evidence. Human judgment.</span>
            <span>Research prototype · Malaysia</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function CashChart({ monthly }: { monthly: Monthly[] }) {
  const max = Math.max(
    1000,
    ...monthly.flatMap((m) => [
      m.income,
      m.operating_expenses + m.household_used + m.debt_used,
    ]),
  );
  const top = Math.ceil(max / 1000) * 1000;
  const width = 620,
    height = 250,
    left = 52,
    bottom = 32,
    plotH = height - bottom - 12;
  const step = (width - left - 10) / monthly.length;
  return (
    <svg
      className="cash-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Monthly recognised income compared with operating costs, household needs and debt"
    >
      <title>Monthly recognised income and costs in MYR</title>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={left}
            x2={width}
            y1={12 + plotH * (1 - f)}
            y2={12 + plotH * (1 - f)}
            stroke="var(--line)"
            strokeDasharray={f ? "3 4" : "0"}
          />
          <text x={left - 10} y={16 + plotH * (1 - f)} textAnchor="end">
            {((top * f) / 1000).toFixed(top < 4000 ? 1 : 0)}k
          </text>
        </g>
      ))}
      {monthly.map((m, i) => {
        const costs = m.operating_expenses + m.household_used + m.debt_used;
        const bar = Math.min(22, step * 0.27);
        return (
          <g key={m.month}>
            <rect
              x={left + i * step + step / 2 - bar - 2}
              y={12 + plotH * (1 - m.income / top)}
              width={bar}
              height={(plotH * m.income) / top}
              rx={2}
              fill="var(--green)"
              opacity={m.complete ? 1 : 0.4}
            >
              <title>
                {m.month}: income {money(m.income)}
              </title>
            </rect>
            <rect
              x={left + i * step + step / 2 + 2}
              y={12 + plotH * (1 - costs / top)}
              width={bar}
              height={(plotH * costs) / top}
              rx={2}
              fill="var(--sage)"
            >
              <title>
                {m.month}: costs {money(costs)}
              </title>
            </rect>
            <text
              x={left + i * step + step / 2}
              y={height - 9}
              textAnchor="middle"
            >
              {new Date(m.month + "-15").toLocaleDateString("en", {
                month: "short",
              })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
function Calibration({
  points,
}: {
  points: { predicted: number; observed: number }[];
}) {
  const x = (n: number) => 48 + n * 280,
    y = (n: number) => 220 - n * 190;
  return (
    <svg
      className="calibration-chart"
      viewBox="0 0 380 265"
      role="img"
      aria-label="Calibration chart comparing predicted and observed probabilities"
    >
      <title>Calibration: closer to the diagonal is better</title>
      {[0, 0.25, 0.5, 0.75, 1].map((n) => (
        <g key={n}>
          <line x1={x(0)} x2={x(1)} y1={y(n)} y2={y(n)} stroke="var(--line)" />
          <text x={35} y={y(n) + 4} textAnchor="end">
            {n}
          </text>
          <text x={x(n)} y={239} textAnchor="middle">
            {n}
          </text>
        </g>
      ))}
      <path
        d={`M ${x(0)} ${y(0)} L ${x(1)} ${y(1)}`}
        stroke="var(--sage)"
        strokeDasharray="4 4"
      />
      <polyline
        points={points
          .map((p) => `${x(p.predicted)},${y(p.observed)}`)
          .join(" ")}
        fill="none"
        stroke="var(--green)"
        strokeWidth={2}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(p.predicted)}
          cy={y(p.observed)}
          r={4}
          fill="var(--green)"
        >
          <title>
            Predicted {pct(p.predicted)}, observed {pct(p.observed)}
          </title>
        </circle>
      ))}
      <text x={190} y={260} textAnchor="middle">
        Predicted probability
      </text>
      <text x={12} y={120} textAnchor="middle" transform="rotate(-90 12 120)">
        Observed rate
      </text>
    </svg>
  );
}
