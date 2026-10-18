import React, { useRef, useState } from "react";
import type { Medication, PrescriptionParseResponse } from "../types";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircleIcon,
  FileTextIcon,
  PlusIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from "./Icons";

interface PrescriptionUploadProps {
  patientId: string;
  onMedicationsConfirmed: (meds: Medication[], ddiResult?: any) => void;
}

export function PrescriptionUpload({
  patientId,
  onMedicationsConfirmed,
}: PrescriptionUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retakeTip, setRetakeTip] = useState<string | null>(null);
  const [parseResponse, setParseResponse] = useState<PrescriptionParseResponse | null>(null);
  const [editableMeds, setEditableMeds] = useState<Medication[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    setErrorMessage(null);
    setRetakeTip(null);
    setParseResponse(null);
    setEditableMeds([]);
    setConfirmSuccess(false);

    // Validation on size
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage("File exceeds 10 MB limit. Please select a smaller file.");
      return;
    }

    setFile(selectedFile);

    // If PDF or image, set preview
    if (selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const loadSample = async (sampleName: string) => {
    setIsUploading(true);
    setErrorMessage(null);
    setRetakeTip(null);
    setParseResponse(null);
    setEditableMeds([]);

    try {
      const res = await fetch(`/api/prescriptions/samples/${sampleName}`);
      if (!res.ok) throw new Error("Could not load sample image from server");
      const blob = await res.blob();
      const sampleFile = new File([blob], sampleName, { type: "image/png" });
      setFile(sampleFile);
      setPreviewUrl(URL.createObjectURL(blob));

      // Immediately send to Mistral VLM for genuine visual inference
      const formData = new FormData();
      formData.append("file", sampleFile);
      formData.append("patient_id", patientId);

      const parseRes = await fetch("/api/prescriptions/parse", {
        method: "POST",
        body: formData,
      });

      const data: PrescriptionParseResponse = await parseRes.json();
      if (!parseRes.ok) {
        throw new Error((data as any).detail || (data as any).error || "Failed to process prescription");
      }

      setParseResponse(data);
      if (data.status === "retake_needed") {
        setRetakeTip(data.tip || "Hold the phone steady and use good light");
        setEditableMeds([]);
      } else {
        setEditableMeds(data.medications || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to parse sample prescription");
    } finally {
      setIsUploading(false);
    }
  };

  const handleParse = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setRetakeTip(null);
    setParseResponse(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("patient_id", patientId);

    try {
      // Calls backend proxy: POST /api/prescriptions/parse
      const res = await fetch("/api/prescriptions/parse", {
        method: "POST",
        body: formData,
      });

      const data: PrescriptionParseResponse = await res.json();

      if (!res.ok) {
        throw new Error((data as any).detail || (data as any).error || "Failed to process prescription");
      }

      setParseResponse(data);

      if (data.status === "retake_needed") {
        setRetakeTip(data.tip || "Hold the phone steady and use good light");
        setEditableMeds([]);
      } else {
        setEditableMeds(data.medications || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect to prescription service.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMedChange = (index: number, field: keyof Medication, value: any) => {
    setEditableMeds((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddManualMed = () => {
    const newMed: Medication = {
      drug_name: "New Medication",
      generic_name: "",
      form: "tablet",
      strength: "",
      frequency: "once daily",
      timing: "morning",
      duration_days: 30,
      confidence: 1.0,
      rxnorm_id: "",
    };
    setEditableMeds((prev) => [...prev, newMed]);
  };

  const handleRemoveMed = (index: number) => {
    setEditableMeds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmMedications = async () => {
    if (editableMeds.length === 0) return;

    setIsConfirming(true);
    setErrorMessage(null);

    try {
      // POST /api/patients/:id/medications to trigger Phase 6 DDI engine automatically
      const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medications: editableMeds }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save medications and evaluate interactions.");
      }

      const ddiData = await res.json();
      setConfirmSuccess(true);
      onMedicationsConfirmed(editableMeds, ddiData);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to confirm medications.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30">
              <SparklesIcon className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              AI Prescription Ingestion
            </h3>
            {parseResponse && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${
                  parseResponse.status === "auto_approved"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : parseResponse.status === "retake_needed"
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                }`}
              >
                {parseResponse.status === "auto_approved" && "Auto-approved"}
                {parseResponse.status === "needs_review" && "Needs review"}
                {parseResponse.status === "retake_needed" && "Retake needed"}
                {parseResponse.status === "approved" && "Approved"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Upload a prescription image (JPG, PNG, HEIC) or multi-page PDF.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.heic,.heif,.pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:bg-slate-750"
          >
            <UploadIcon className="h-3.5 w-3.5 text-cyan-400" />
            Pick File
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
          >
            <CameraIcon className="h-3.5 w-3.5 text-cyan-300" />
            Take Photo
          </button>
        </div>
      </div>

      {/* Drag & Drop Zone / Preview */}
      {!file ? (
        <div>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700/80 bg-slate-950/40 p-8 text-center transition-colors hover:border-cyan-500/60 hover:bg-slate-900/60"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 mb-3">
              <UploadIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-200">
              Drag and drop a prescription, or click to browse
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Accepts JPG, PNG, HEIC, or PDF up to 10 MB (Processed via Mistral AI Vision VLM)
            </p>
          </div>

          {/* Quick Sample Prescriptions */}
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Try Real Prescriptions:
            </span>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => loadSample("printed.png")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-slate-750 disabled:opacity-50"
            >
              <FileTextIcon className="h-3 w-3 text-cyan-400" />
              📄 Printed Rx (St. Jude Clinic)
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => loadSample("neat_handwriting.png")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-emerald-500/50 hover:bg-slate-750 disabled:opacity-50"
            >
              <FileTextIcon className="h-3 w-3 text-emerald-400" />
              ✍️ Handwritten (Wellness Center)
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => loadSample("messy.png")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-amber-500/50 hover:bg-slate-750 disabled:opacity-50"
            >
              <AlertTriangleIcon className="h-3 w-3 text-amber-400" />
              ⚠️ Messy Script (Metro Clinic)
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Prescription preview"
                  className="h-16 w-16 rounded-lg object-cover border border-slate-700"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300">
                  <FileTextIcon className="h-7 w-7 text-cyan-400" />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                  {file.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type || "Document"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={handleParse}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-sky-500 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Reading prescription...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-3.5 w-3.5" />
                    Parse Prescription
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  setParseResponse(null);
                  setEditableMeds([]);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retake Needed Warning Box */}
      {retakeTip && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Retake Needed
              </h4>
              <p className="mt-1 text-sm font-medium text-amber-100">{retakeTip}</p>
              {parseResponse?.warnings && parseResponse.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-xs text-amber-300/80 space-y-0.5">
                  {parseResponse.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Needs Review Clinical Warning Box */}
      {!retakeTip && parseResponse?.status === "needs_review" && parseResponse.warnings && parseResponse.warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Pharmacist Verification Required ({Math.round(parseResponse.overall_confidence * 100)}% Confidence)
                </h4>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  Mistral AI Vision
                </span>
              </div>
              <p className="mt-1 text-xs text-amber-200">
                Cursive handwriting detected with clinical notes or ambiguous abbreviations. Please review the extracted dosages below:
              </p>
              <ul className="mt-2 list-disc pl-4 text-xs text-amber-300/90 space-y-0.5">
                {parseResponse.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Generic Error Message */}
      {errorMessage && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Confirmation Success Alert */}
      {confirmSuccess && (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>Medications confirmed and evaluated by drug interaction safety engine!</span>
        </div>
      )}

      {/* Parsed Results Editable Table */}
      {editableMeds.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Parsed Medication Regimen ({editableMeds.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              Low-confidence entries highlighted in yellow.
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="px-3 py-2.5">Drug Name</th>
                  <th className="px-3 py-2.5">Strength</th>
                  <th className="px-3 py-2.5">Frequency</th>
                  <th className="px-3 py-2.5">Timing</th>
                  <th className="px-3 py-2.5">Duration</th>
                  <th className="px-3 py-2.5 text-center">Confidence</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {editableMeds.map((med, idx) => {
                  const isLowConf = (med.confidence ?? 1.0) < 0.75;
                  return (
                    <tr
                      key={idx}
                      className={isLowConf ? "bg-amber-500/10 transition-colors" : ""}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={med.drug_name}
                          onChange={(e) => handleMedChange(idx, "drug_name", e.target.value)}
                          className="w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        />
                        {med.generic_name && (
                          <div className="mt-0.5 text-[10px] text-slate-400 italic">
                            ({med.generic_name})
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={med.strength}
                          onChange={(e) => handleMedChange(idx, "strength", e.target.value)}
                          className="w-24 rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => handleMedChange(idx, "frequency", e.target.value)}
                          className="w-28 rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={med.timing}
                          onChange={(e) => handleMedChange(idx, "timing", e.target.value)}
                          className="w-28 rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={med.duration_days || ""}
                          onChange={(e) =>
                            handleMedChange(idx, "duration_days", parseInt(e.target.value) || 0)
                          }
                          className="w-16 rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                          placeholder="days"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                            isLowConf
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {Math.round((med.confidence ?? 0.8) * 100)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveMed(idx)}
                          className="text-slate-400 hover:text-rose-400"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleAddManualMed}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add a medicine manually
            </button>

            <button
              type="button"
              disabled={isConfirming || editableMeds.length === 0}
              onClick={handleConfirmMedications}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50"
            >
              {isConfirming ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving Regimen...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  Confirm medications
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mandatory Safety Disclaimer */}
      <div className="mt-4 border-t border-slate-800/80 pt-3 text-center">
        <p className="text-[11px] font-medium tracking-wide text-slate-400">
          ⚠️ Always confirm medicines with your doctor or pharmacist.
        </p>
      </div>
    </div>
  );
}
