"use client";
import { useMemo, useState } from "react";
import {
  Upload,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  FileText,
  LoaderCircle,
  Download,
  Trash2,
} from "lucide-react";
import "./documents.css";
import {
  EvidenceReview,
  EvidenceComparison,
  type Comparison,
} from "./evidence-review";

type Tx = {
  transaction_id: string;
  date: string;
  amount: number;
  balance: number | null;
  description: string;
  category: string;
  page: number;
  line: number;
};
type Doc = {
  id: string;
  filename: string;
  kind: string;
  sha256: string;
  method?: string;
  period_start?: string;
  period_end?: string;
  reconciled?: boolean;
  transactions: Tx[];
  facts: { label: string; value: string; page: number }[];
  warnings: string[];
};
type Batch = { id: string; documents: Doc[]; simulated: boolean };
const categories = [
  "income",
  "expense",
  "household",
  "debt",
  "transfer",
  "unknown",
];
const labels: Record<string, string> = {
  bank_statement: "Bank statement",
  structured_evidence: "Earnings / payment schedule",
  utility_bill: "Utility bill",
  paylater_history: "PayLater history",
  grab_activity: "Grab activity",
  unsupported: "Needs another format",
};
const money = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
      }).format(n);
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Check the form values.",
    );
  return data;
}

export default function DocumentWorkspace({
  onAssessment,
}: {
  onAssessment: (result: unknown) => void;
}) {
  const [batch, setBatch] = useState<Batch | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [edits, setEdits] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [hidden, setHidden] = useState(true),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [filter, setFilter] = useState("all");
  const [confirmedMatches, setConfirmedMatches] = useState<
    Record<string, string>
  >({});
  const [confirmedDebt, setConfirmedDebt] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [checks, setChecks] = useState([false, false, false, false]);
  const [applicant, setApplicant] = useState({
    name: "Private applicant",
    kind: "worker",
    purpose: "Equipment / productive financing",
    requested_amount: 5000,
    tenure_months: 12,
    household_expenses: 1600,
    monthly_obligations: 0,
  });
  const [policy, setPolicy] = useState({
    revenue_shock: 0.2,
    expense_shock: 0.1,
    capacity_share: 0.5,
    annual_rate: 0.12,
    minimum_months: 6,
  });
  const rows = useMemo(
    () =>
      batch?.documents
        .filter((d) => selected.includes(d.id) && d.kind === "bank_statement")
        .flatMap((d) =>
          d.transactions.map((t) => ({
            ...t,
            source: d.filename,
            docId: d.id,
          })),
        ) || [],
    [batch, selected],
  );
  const filtered = rows.filter(
    (t) =>
      (filter === "all" ||
        (edits[t.transaction_id] || t.category) === filter) &&
      (!query || t.description.toLowerCase().includes(query.toLowerCase())),
  );
  const unresolved = rows.filter(
    (t) => (edits[t.transaction_id] || t.category) === "unknown",
  ).length;
  const blocked = !!batch?.documents.some(
    (d) =>
      selected.includes(d.id) &&
      (d.kind === "unsupported" ||
        (d.kind === "bank_statement" && !d.reconciled)),
  );
  const currentKey = JSON.stringify({
    selected,
    edits,
    applicant,
    policy,
    confirmedMatches,
    confirmedDebt,
  });
  function accept(b: Batch) {
    setComparison(null);
    setConfirmedMatches({});
    setConfirmedDebt([]);
    setBatch(b);
    setSelected(
      b.documents.filter((d) => d.kind !== "unsupported").map((d) => d.id),
    );
    setEdits({});
    setChecks([false, false, false, false]);
    setPage(0);
    setQuery("");
    setFilter("all");
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));
      accept(
        await api<Batch>("/api/documents/upload", {
          method: "POST",
          body: form,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError("");
    try {
      accept(await api<Batch>("/api/documents/demo", { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function alternativeDemo() {
    setBusy(true);
    setError("");
    try {
      accept(
        await api<Batch>("/api/documents/alternative-demo", { method: "POST" }),
      );
      setApplicant({
        name: "Aina Rahman",
        kind: "worker",
        purpose: "Laptop and work equipment",
        requested_amount: 8000,
        tenure_months: 12,
        household_expenses: 1600,
        monthly_obligations: 250,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    if (!batch) return;
    setBusy(true);
    try {
      await api(`/api/documents/${batch.id}`, { method: "DELETE" });
      setBatch(null);
      setEdits({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function assess(preview = false) {
    if (!batch) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ evidence_comparison: Comparison }>(
        `/api/documents/${batch.id}/assess${preview ? "?preview=true" : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicant,
            policy,
            selected_document_ids: selected,
            categories: Object.fromEntries(
              Object.entries(edits).filter(([key]) =>
                rows.some((t) => t.transaction_id === key),
              ),
            ),
            acknowledged: checks[0],
            single_account_confirmed: checks[1],
            period_confirmed: checks[2],
            additional_obligations_confirmed: checks[3],
            confirmed_matches: confirmedMatches,
            confirmed_debt_ids: confirmedDebt,
          }),
        },
      );
      if (preview) {
        setComparison(result.evidence_comparison);
        setPreviewKey(currentKey);
      } else {
        onAssessment(result);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="document-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DOCUMENTS → EVIDENCE → ASSESSMENT</p>
          <h1>Start with the evidence.</h1>
          <p>
            Local PDF extraction and screenshot OCR, with an analyst review
            before calculation.
          </p>
        </div>
        <button className="secondary" onClick={() => setHidden(!hidden)}>
          {hidden ? <Eye size={16} /> : <EyeOff size={16} />}{" "}
          {hidden ? "Reveal local values" : "Hide personal values"}
        </button>
      </div>
      <div className="doc-privacy">
        <ShieldCheck size={20} />
        <div>
          <strong>Your documents stay on this computer.</strong>
          <p>
            No external OCR or AI service. Original uploads are processed in
            temporary files and removed afterwards. Extracted review data and
            saved assessments stay in the local database. Values are hidden by
            default for screen sharing.
          </p>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="upload-zone">
        <Upload size={27} />
        <h2>Bank statements, bills & screenshots</h2>
        <p>
          Upload the complete set together: up to 16 files, PDF / PNG / JPG.
          <br />
          One bank account per assessment. Supporting records are kept separate.
        </p>
        <label className="primary">
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Upload size={16} />
          )}{" "}
          {busy ? "Processing locally…" : "Choose documents"}
          <input
            aria-label="Choose documents"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            multiple
            disabled={busy}
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <div>
          <button className="primary" disabled={busy} onClick={alternativeDemo}>
            Try Aina’s alternative-data story
          </button>
          <a href="/api/documents/alternative-demo.zip" className="text-button">
            Download Aina’s fictional evidence
          </a>
          <button className="text-button" disabled={busy} onClick={demo}>
            Try synthetic document pack <ArrowRight size={14} />
          </button>
          <a href="/api/documents/demo-pack.zip" className="text-button">
            <Download size={14} />
            Download demo PDFs
          </a>
        </div>
      </div>
      {batch && (
        <>
          <div className="section-heading">
            <div>
              <h3>01 · Check extracted documents</h3>
              <p>
                {batch.documents.length} unique documents ·{" "}
                {batch.simulated
                  ? "Synthetic demo pack"
                  : "Private user-supplied documents"}{" "}
                · {rows.length} selected bank rows
              </p>
            </div>
            <button className="text-button" disabled={busy} onClick={discard}>
              <Trash2 size={15} />
              Discard review batch
            </button>
          </div>
          <div className="doc-list">
            {batch.documents.map((d, i) => (
              <article key={d.id}>
                <div className="doc-title">
                  <input
                    type="checkbox"
                    aria-label={`Include document ${i + 1}`}
                    checked={selected.includes(d.id)}
                    onChange={(e) => {
                      setSelected(
                        e.target.checked
                          ? [...selected, d.id]
                          : selected.filter((id) => id !== d.id),
                      );
                      setChecks([false, false, false, false]);
                      setPage(0);
                    }}
                  />
                  <FileText size={20} />
                  <div>
                    <strong>{hidden ? `Document ${i + 1}` : d.filename}</strong>
                    <small>
                      {labels[d.kind]} · {d.method || "Not imported"}
                    </small>
                  </div>
                  <span
                    className={`tag ${d.reconciled === false ? "doc-bad" : ""}`}
                  >
                    {d.kind === "bank_statement"
                      ? d.reconciled
                        ? "Totals reconcile"
                        : "Reconciliation failed"
                      : "Supporting evidence only"}
                  </span>
                </div>
                {d.kind === "bank_statement" ? (
                  <p>
                    {d.period_start} — {d.period_end} · {d.transactions.length}{" "}
                    extracted ledger rows
                  </p>
                ) : (
                  d.facts.map((f, k) => (
                    <p key={k}>
                      <strong>{f.label}:</strong> {hidden ? "••••" : f.value}{" "}
                      <small className="inline-small">Page {f.page}</small>
                    </p>
                  ))
                )}
                {d.warnings.map((w) => (
                  <p className="doc-warning" key={w}>
                    {w}
                  </p>
                ))}
                <details>
                  <summary>Source fingerprint</summary>
                  <small className="hash">{d.sha256}</small>
                </details>
              </article>
            ))}
          </div>
          <div className="section-heading">
            <div>
              <h3>02 · Review transaction categories</h3>
              <p>
                {unresolved} unresolved categories. Unknown credits do not count
                as income; unknown debits remain costs. Supporting bills never
                add duplicate cash entries.
              </p>
            </div>
          </div>
          <div className="doc-filters">
            <label>
              Find description
              <input
                placeholder="Filter bank description"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Category
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <span>{filtered.length} matching rows</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date / source</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Reviewed category</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(page * 20, (page + 1) * 20).map((t) => (
                  <tr key={t.transaction_id}>
                    <td>
                      {t.date}
                      <small>
                        {hidden ? "Local document" : t.source} · p{t.page}, row{" "}
                        {t.line}
                      </small>
                    </td>
                    <td>{hidden ? "Description hidden" : t.description}</td>
                    <td>{hidden ? "••••" : money(t.amount)}</td>
                    <td>{hidden ? "••••" : money(t.balance)}</td>
                    <td>
                      <select
                        aria-label={`Category ${t.transaction_id}`}
                        value={edits[t.transaction_id] || t.category}
                        onChange={(e) => {
                          setEdits({
                            ...edits,
                            [t.transaction_id]: e.target.value,
                          });
                          setChecks([false, ...checks.slice(1)]);
                        }}
                      >
                        {categories
                          .filter((c) =>
                            t.amount >= 0
                              ? !["expense", "household", "debt"].includes(c)
                              : c !== "income",
                          )
                          .map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="doc-pagination">
            <button
              className="secondary"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous rows
            </button>
            <span>
              Page {page + 1} / {Math.max(1, Math.ceil(filtered.length / 20))}
            </span>
            <button
              className="secondary"
              disabled={(page + 1) * 20 >= filtered.length}
              onClick={() => setPage(page + 1)}
            >
              Next rows
            </button>
          </div>
          <EvidenceReview
            batchId={batch.id}
            selected={selected}
            hidden={hidden}
            matches={confirmedMatches}
            debtIds={confirmedDebt}
            onMatches={(v) => {
              setConfirmedMatches(v);
              setChecks([false, false, false, false]);
            }}
            onDebt={(v) => {
              setConfirmedDebt(v);
              setChecks([false, false, false, false]);
            }}
          />
          <section className="doc-application">
            <h3>03 · Confirm the application & obligations</h3>
            <p className="muted">
              Use a display alias for a public demonstration. Household and debt
              amounts should cover all obligations, including other accounts or
              PayLater. They act as monthly floors, not additions to the same
              recorded expenses.
            </p>
            <div className="form-grid">
              <label>
                Applicant display name
                <input
                  value={applicant.name}
                  onChange={(e) =>
                    setApplicant({ ...applicant, name: e.target.value })
                  }
                />
              </label>
              <label>
                Applicant type
                <select
                  value={applicant.kind}
                  onChange={(e) =>
                    setApplicant({ ...applicant, kind: e.target.value })
                  }
                >
                  <option value="worker">Worker / freelancer</option>
                  <option value="business">Microbusiness</option>
                </select>
              </label>
              <label className="span-2">
                Financing purpose
                <input
                  value={applicant.purpose}
                  onChange={(e) =>
                    setApplicant({ ...applicant, purpose: e.target.value })
                  }
                />
              </label>
              {(
                [
                  ["requested_amount", "Requested financing (RM)"],
                  ["tenure_months", "Tenure (months)"],
                  [
                    "household_expenses",
                    applicant.kind === "worker"
                      ? "Household needs (RM/month)"
                      : "Owner household draw (RM/month)",
                  ],
                  [
                    "monthly_obligations",
                    "Total monthly debt obligations (RM)",
                  ],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    value={applicant[key]}
                    onChange={(e) => {
                      setApplicant({
                        ...applicant,
                        [key]: Number(e.target.value),
                      });
                      setChecks([checks[0], checks[1], checks[2], false]);
                    }}
                  />
                </label>
              ))}
            </div>
            <details>
              <summary>Edit demonstration stress policy</summary>
              <div className="form-grid">
                {(
                  [
                    ["revenue_shock", "Income reduction (%)"],
                    ["expense_shock", "Expense increase (%)"],
                    ["capacity_share", "Share of stressed surplus (%)"],
                    ["annual_rate", "Illustrative annual rate (%)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(policy[key] * 100)}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          [key]: Number(e.target.value) / 100,
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Minimum complete months
                  <input
                    type="number"
                    min={3}
                    max={24}
                    value={policy.minimum_months}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        minimum_months: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            </details>
          </section>
          <div className="doc-confirm">
            {[
              "I reviewed extracted transactions and categories against the originals.",
              "Selected bank statements belong to one account; the bills relate to this applicant.",
              "The statement months are complete; I have checked for gaps and overlapping records.",
              "Household needs and total debt obligations include relevant PayLater or other-account commitments.",
            ].map((label, i) => (
              <label key={label}>
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={(e) =>
                    setChecks(
                      checks.map((c, j) => (i === j ? e.target.checked : c)),
                    )
                  }
                />
                {label}
              </label>
            ))}
            <p>
              Repayment punctuality, document authenticity and Malaysian default
              probability remain unverified. This produces an affordability
              demonstration, not a lending decision.
            </p>
          </div>
          <button
            className="primary"
            disabled={busy || !checks.every(Boolean) || !rows.length || blocked}
            onClick={() => assess(false)}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <ArrowRight size={17} />
            )}
            Calculate reviewed assessment
          </button>
          <button
            className="secondary"
            disabled={busy || !checks.every(Boolean) || !rows.length || blocked}
            onClick={() => assess(true)}
          >
            Compare evidence impact
          </button>
          {comparison &&
            (previewKey === currentKey ? (
              <EvidenceComparison value={comparison} hidden={hidden} />
            ) : (
              <p role="status">
                Evidence or inputs changed. Run the comparison again.
              </p>
            ))}
          {blocked && (
            <p role="status" className="doc-warning">
              Exclude unsupported or unreconciled documents to continue.
            </p>
          )}
        </>
      )}
    </div>
  );
}
