import React, { useEffect, useState } from "react";
import type { Medication, ReviewQueueItem } from "../types";
import { CheckCircleIcon, CheckIcon, FileTextIcon, SparklesIcon, XIcon } from "./Icons";

interface PharmacistReviewProps {
  userRole?: string;
}

export function PharmacistReview({ userRole = "pharmacist" }: PharmacistReviewProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [editedDrafts, setEditedDrafts] = useState<Record<string, Medication[]>>({});

  const isAuthorized = userRole === "pharmacist" || userRole === "admin";

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      // Calls backend proxy: GET /api/prescriptions/review-queue
      const res = await fetch("/api/prescriptions/review-queue");
      if (!res.ok) {
        throw new Error("Failed to load review queue.");
      }
      const data: ReviewQueueItem[] = await res.json();
      setItems(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }

      // Initialize draft edits
      const drafts: Record<string, Medication[]> = {};
      for (const item of data) {
        drafts[item.id] = JSON.parse(JSON.stringify(item.parsed_draft || []));
      }
      setEditedDrafts(drafts);
    } catch (err: any) {
      setError(err.message || "Failed to fetch review queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchQueue();
    }
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <h3 className="text-base font-semibold text-rose-300">Role-Gated Screen</h3>
        <p className="mt-1 text-xs text-rose-200/80">
          Pharmacist or Admin role is required to access the Prescription Review Queue.
        </p>
      </div>
    );
  }

  const selectedItem = items.find((i) => i.id === selectedId);
  const currentDraft = selectedItem ? editedDrafts[selectedItem.id] || selectedItem.parsed_draft : [];

  const handleFieldChange = (medIdx: number, field: keyof Medication, val: any) => {
    if (!selectedId) return;
    setEditedDrafts((prev) => {
      const copy = [...(prev[selectedId] || [])];
      copy[medIdx] = { ...copy[medIdx], [field]: val };
      return { ...prev, [selectedId]: copy };
    });
  };

  const handleApprove = async (withEdits: boolean) => {
    if (!selectedItem) return;
    setIsApproving(true);
    setActionSuccess(null);
    setError(null);

    try {
      const payload: any = {
        approved_by: `Pharmacist (${userRole})`,
      };
      if (withEdits) {
        payload.edited_draft = currentDraft;
      }

      // Calls backend proxy: POST /api/prescriptions/:id/approve
      const res = await fetch(`/api/prescriptions/${encodeURIComponent(selectedItem.id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to approve prescription.");
      }

      setActionSuccess(`Prescription ${selectedItem.id} approved successfully.`);
      // Remove from queue locally
      setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
      setSelectedId(null);
    } catch (err: any) {
      setError(err.message || "Approval failed.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <FileTextIcon className="h-3.5 w-3.5" />
            </span>
            Pharmacist Review Queue
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Review AI-parsed prescriptions requiring pharmacist validation before clinical execution.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchQueue}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-750"
        >
          Refresh Queue
        </button>
      </div>

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
          Loading review queue...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <CheckCircleIcon className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
          <h4 className="text-sm font-semibold text-slate-200">All Clear</h4>
          <p className="mt-1 text-xs text-slate-400">No prescriptions awaiting review in the queue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Queue Sidebar */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
              Pending Prescriptions ({items.length})
            </div>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  item.id === selectedId
                    ? "border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{item.id}</span>
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 uppercase">
                    Needs Review
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Patient: {item.patient_id || "Anonymous"} · Conf: {Math.round(item.overall_confidence * 100)}%
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {new Date(item.created_at).toLocaleTimeString()}
                </div>
              </button>
            ))}
          </div>

          {/* Review Details Area */}
          {selectedItem && (
            <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Prescription Verification: {selectedItem.id}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Patient ID: {selectedItem.patient_id} · Overall AI Confidence:{" "}
                    {Math.round(selectedItem.overall_confidence * 100)}%
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isApproving}
                    onClick={() => handleApprove(false)}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    Approve (1-Tap)
                  </button>

                  <button
                    type="button"
                    disabled={isApproving}
                    onClick={() => handleApprove(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-sky-500 disabled:opacity-50"
                  >
                    <SparklesIcon className="h-3.5 w-3.5" />
                    Edit & Approve
                  </button>
                </div>
              </div>

              {/* Side-by-side view: Cropped Image beside Parsed Draft */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Cropped Image */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Original Prescription Crop
                  </h4>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2 overflow-hidden flex items-center justify-center min-h-[220px]">
                    {selectedItem.cropped_image ? (
                      <img
                        src={selectedItem.cropped_image}
                        alt="Cropped prescription body"
                        className="max-h-72 w-auto rounded object-contain border border-slate-800"
                      />
                    ) : (
                      <div className="text-xs text-slate-400 italic">No image available</div>
                    )}
                  </div>
                </div>

                {/* Right: Editable Parsed Draft */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Parsed Draft ({currentDraft.length} items)
                  </h4>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {currentDraft.map((med, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={med.drug_name}
                            onChange={(e) => handleFieldChange(idx, "drug_name", e.target.value)}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                            placeholder="Drug Name"
                          />
                          <input
                            type="text"
                            value={med.strength}
                            onChange={(e) => handleFieldChange(idx, "strength", e.target.value)}
                            className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white text-xs focus:border-cyan-500 focus:outline-none"
                            placeholder="Strength"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={med.frequency}
                            onChange={(e) => handleFieldChange(idx, "frequency", e.target.value)}
                            className="w-1/2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white text-xs focus:border-cyan-500 focus:outline-none"
                            placeholder="Frequency"
                          />
                          <input
                            type="text"
                            value={med.timing}
                            onChange={(e) => handleFieldChange(idx, "timing", e.target.value)}
                            className="w-1/2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white text-xs focus:border-cyan-500 focus:outline-none"
                            placeholder="Timing"
                          />
                        </div>

                        {med.generic_name && (
                          <div className="text-[10px] text-slate-400 italic">
                            Generic: {med.generic_name} {med.rxnorm_id ? `· RxNorm: ${med.rxnorm_id}` : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Safety disclaimer */}
              <div className="border-t border-slate-800 pt-2 text-center">
                <p className="text-[11px] text-slate-400">
                  ⚠️ Always confirm medicines with your doctor or pharmacist.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
