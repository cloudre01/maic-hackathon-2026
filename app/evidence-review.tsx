"use client";
import { useEffect, useState } from "react";

type Item = {
  id: string;
  kind: string;
  reference: string;
  date: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  contract: string;
  balance: number | null;
  filename: string;
  page: number;
  line: number;
  status: string;
  payment_timing: string;
  candidates: {
    transaction_id: string;
    date: string;
    amount: number;
    description: string;
    reference_match: boolean;
  }[];
};
export type Comparison = {
  stages: {
    label: string;
    status: string;
    metrics: {
      median_income: number;
      monthly_capacity: number;
      requested_instalment: number;
      complete_months: number;
      transaction_count: number;
    };
  }[];
  category_changes: {
    evidence_id: string;
    transaction_id: string;
    before: string;
    after: string;
    reason: string;
  }[];
  debt_review: { suggested_monthly_floor: number; assumption: string };
  declared_monthly_obligations: number;
  effective_monthly_obligations: number;
  note: string;
};
const rm = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );
const status: Record<string, string> = {
  WITHIN_CAPACITY: "Within demo capacity",
  EXCEEDS_CAPACITY: "Exceeds demo capacity",
  REFER: "Analyst review needed",
  INSUFFICIENT_DATA: "Insufficient evidence",
};

export function EvidenceComparison({
  value,
  hidden = false,
}: {
  value: Comparison;
  hidden?: boolean;
}) {
  return (
    <section className="evidence-comparison">
      <p className="eyebrow">WHAT THE EVIDENCE CHANGES</p>
      <h3>Same applicant. A clearer picture.</h3>
      <p>{value.note}</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Evidence used</th>
              <th>Recognized income / month</th>
              <th>Repayment capacity / month</th>
              <th>Demo assessment</th>
            </tr>
          </thead>
          <tbody>
            {value.stages.map((s, i) => (
              <tr key={s.label}>
                <td>
                  <strong>
                    {i + 1}. {s.label}
                  </strong>
                </td>
                <td>{hidden ? "••••" : rm(s.metrics.median_income)}</td>
                <td>{hidden ? "••••" : rm(s.metrics.monthly_capacity)}</td>
                <td>{status[s.status] || s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {value.category_changes.length} confirmed category actions ·{" "}
        {value.stages[0].metrics.transaction_count} bank rows in every stage ·
        no supporting cash entries added.
      </p>
      <p>
        Declared monthly debt:{" "}
        {hidden ? "••••" : rm(value.declared_monthly_obligations)}. Confirmed
        schedule peak:{" "}
        {hidden ? "••••" : rm(value.debt_review.suggested_monthly_floor)}.
        Effective floor:{" "}
        {hidden ? "••••" : rm(value.effective_monthly_obligations)}.
      </p>
      <details>
        <summary>Why did the figures change?</summary>
        <p>{value.debt_review.assumption}</p>
        <ul>
          {value.category_changes.map((c) => (
            <li key={c.evidence_id}>
              {hidden ? "Reviewed bank row" : c.transaction_id}: {c.before} →{" "}
              {c.after}. {c.reason}
            </li>
          ))}
        </ul>
        <p>
          Supporting balances are snapshots, not amounts to sum. Payment timing
          is source-reported and does not verify authenticity or overall
          creditworthiness.
        </p>
      </details>
    </section>
  );
}

export function EvidenceReview({
  batchId,
  selected,
  hidden,
  matches,
  debtIds,
  onMatches,
  onDebt,
}: {
  batchId: string;
  selected: string[];
  hidden: boolean;
  matches: Record<string, string>;
  debtIds: string[];
  onMatches: (v: Record<string, string>) => void;
  onDebt: (v: string[]) => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const selection = selected.join(",");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    onMatches({});
    onDebt([]);
    fetch(`/api/documents/${batchId}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selected_document_ids: selection ? selection.split(",") : [],
      }),
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok)
          throw Error(
            typeof b.detail === "string"
              ? b.detail
              : "Select at least one document.",
          );
        if (active) setItems(b.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Reset confirmations whenever the set of source documents changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, selection]);
  if (error) return <p role="alert">{error}</p>;
  if (loading)
    return <p role="status">Matching supporting evidence locally…</p>;
  if (!items.length)
    return (
      <p className="muted">
        No structured earnings or schedules in this selection. Generic bills and
        screenshots remain supporting evidence; unknown fields are not inferred.
      </p>
    );
  const debt = items.filter((i) => i.kind === "repayment");
  const unique = items.filter((i) => i.status === "reference_match");
  function confirmReferences() {
    const result: Record<string, string> = {};
    const used = new Set<string>();
    for (const i of unique) {
      const c = i.candidates.find((c) => c.reference_match)!;
      if (!used.has(c.transaction_id)) {
        result[i.id] = c.transaction_id;
        used.add(c.transaction_id);
      }
    }
    onMatches(result);
  }
  return (
    <section className="evidence-review">
      <p className="eyebrow">CORROBORATE THE BANK RECORD</p>
      <h3>Connect income and commitments.</h3>
      <p>
        Match suggestions use amount, date within three days and reference.
        Confirm only after checking the sources. Supporting documents never add
        new bank transactions.
      </p>
      <button
        className="secondary"
        disabled={hidden || !unique.length}
        onClick={confirmReferences}
      >
        Confirm {unique.length} reference matches after review
      </button>
      {hidden && (
        <p className="muted">Reveal local values before confirming evidence.</p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Evidence / source</th>
              <th>Amount & date</th>
              <th>Bank match to confirm</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.kind}</strong>
                  <small>
                    {hidden
                      ? "Source hidden"
                      : `${i.filename} · ${i.reference}`}{" "}
                    · p{i.page}, row {i.line}
                  </small>
                </td>
                <td>
                  {hidden ? "••••" : rm(i.amount)}
                  <small>{i.paid_date || i.date}</small>
                </td>
                <td>
                  <select
                    aria-label={`Confirm match ${i.reference}`}
                    disabled={hidden || !i.candidates.length}
                    value={matches[i.id] || ""}
                    onChange={(e) => {
                      const updated = { ...matches };
                      if (e.target.value) updated[i.id] = e.target.value;
                      else delete updated[i.id];
                      onMatches(updated);
                    }}
                  >
                    <option value="">
                      {i.status === "unmatched"
                        ? "No bank match — not applied"
                        : "Not confirmed"}
                    </option>
                    {i.candidates.map((c) => (
                      <option key={c.transaction_id} value={c.transaction_id}>
                        {hidden
                          ? "Candidate hidden"
                          : `${c.date} · ${rm(c.amount)} · ${c.description}`}{" "}
                        {c.reference_match
                          ? "· reference agrees"
                          : "· amount/date only"}
                      </option>
                    ))}
                  </select>
                  <small>{i.status.replaceAll("_", " ")}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {debt.length > 0 && (
        <>
          <h3>Review the repayment schedule.</h3>
          <p>
            Check installment amounts, contract IDs, due dates and
            source-reported payment dates. Confirmed rows set a conservative
            peak monthly debt floor; that floor is compared with declared total
            debt and observed bank debt, never added to the same payment twice.
          </p>
          <button
            className="secondary"
            disabled={hidden}
            onClick={() => onDebt(debt.map((i) => i.id))}
          >
            Confirm displayed schedule after review
          </button>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Use</th>
                  <th>Contract / installment</th>
                  <th>Due / paid</th>
                  <th>Reported balance</th>
                  <th>Source-reported timing</th>
                </tr>
              </thead>
              <tbody>
                {debt.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <input
                        type="checkbox"
                        disabled={hidden}
                        aria-label={`Use obligation ${i.reference}`}
                        checked={debtIds.includes(i.id)}
                        onChange={(e) =>
                          onDebt(
                            e.target.checked
                              ? [...debtIds, i.id]
                              : debtIds.filter((id) => id !== i.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      {hidden ? "••••" : `${i.contract} · ${rm(i.amount)}`}
                    </td>
                    <td>
                      {i.due_date}
                      <small>{i.paid_date || "Payment date unavailable"}</small>
                    </td>
                    <td>
                      {hidden
                        ? "••••"
                        : i.balance === null
                          ? "Unavailable"
                          : rm(i.balance)}
                    </td>
                    <td>{i.payment_timing.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            A missing payment date is not proof of nonpayment. A partial
            schedule is not a complete liability check. Exclude incorrect rows
            and supply a corrected source; extraction values cannot be silently
            overwritten.
          </p>
        </>
      )}
    </section>
  );
}
