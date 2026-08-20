"use client";
import { useState, useEffect, useCallback, useId, useRef } from "react";
import { toast } from "sonner";
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Download,
    File as FileIcon,
    FileArchive,
    FileImage,
    FileSpreadsheet,
    FileText,
    FolderOpen,
    Trash2,
    Upload,
    X,
    type LucideIcon,
} from "lucide-react";
import { usePatient } from "../../PatientProvider";
import { useAuth } from "@/hooks/useAuth";
import { getPatientDocuments, uploadPatientDocument, downloadPatientDocument, deletePatientDocument } from "@/lib/api";
import type { PatientDocument } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { formatRegistered } from "@/components/patient-dashboard/dashboard-data";

const PAGE_SIZE = 10;
const SKELETON_ROWS = 4;

/** Mirrors PatientDocumentController.deleteDocument's @PreAuthorize roles. */
const DELETE_ROLES = ["FRONT_DESK", "BRANCH_ADMIN", "SUPER_ADMIN"];

/** Same option values as before; labels in sentence case. */
const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "LAB_REPORT_INTERNAL", label: "Internal lab report" },
    { value: "LAB_REPORT_EXTERNAL", label: "External lab report" },
    { value: "PRESCRIPTION", label: "Prescription" },
    { value: "MEDICAL_HISTORY", label: "Medical history" },
    { value: "ID_VERIFICATION", label: "ID verification" },
    { value: "INSURANCE_DOCUMENT", label: "Insurance document" },
    { value: "CONSENT_FORM", label: "Consent form" },
    { value: "OTHER", label: "Other" },
];

function documentTypeLabel(type: string): string {
    const known = DOCUMENT_TYPE_OPTIONS.find((o) => o.value === type);
    if (known) return known.label;
    const words = (type || "").toLowerCase().replace(/_/g, " ").trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Other";
}

function formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Pick a lucide file icon from the MIME type (falls back to the extension). */
function fileIcon(contentType?: string, fileName?: string): LucideIcon {
    const mime = (contentType || "").toLowerCase();
    const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
    if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "heic"].includes(ext)) return FileImage;
    if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv" || ["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
    if (mime.includes("zip") || mime.includes("compressed") || mime.includes("tar") || ["zip", "rar", "7z", "gz"].includes(ext)) return FileArchive;
    if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("word") || ["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) return FileText;
    return FileIcon;
}

function toDate(value?: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export default function PatientDocumentsTab() {
    const { patient } = usePatient();
    const { roles } = useAuth();
    const canDelete = roles.some((r) => DELETE_ROLES.includes(r));

    const [documents, setDocuments] = useState<PatientDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);

    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState("LAB_REPORT_INTERNAL");
    const [description, setDescription] = useState("");
    const [dragActive, setDragActive] = useState(false);

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fileInputId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typeSelectRef = useRef<HTMLSelectElement>(null);
    const uploadCardRef = useRef<HTMLDivElement>(null);
    // Focus management for the inline delete confirm: remember each row's
    // trigger so focus can return to it on cancel, and a landing spot for
    // after a successful delete (the row itself is gone by then).
    const listRef = useRef<HTMLDivElement>(null);
    const deleteTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const restoreFocusId = useRef<string | null>(null);

    const loadDocuments = useCallback(async (pageIndex: number = 0) => {
        if (!patient || (!patient.id && !patient.patientId)) return;
        const patientCode = patient.id || patient.patientId;

        setLoading(true);
        setLoadError(null);
        try {
            const data = await getPatientDocuments(patientCode as string, { page: pageIndex, size: PAGE_SIZE });
            setDocuments(data.content || []);
            setTotalPages(data.totalPages || 1);
            setTotalElements(data.totalElements || 0);
            setPage(pageIndex);
        } catch (error) {
            console.error("Failed to load documents", error);
            setLoadError("Couldn't load documents. Check your connection and retry.");
        } finally {
            setLoading(false);
        }
    }, [patient]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    // Move focus into the upload form when it opens.
    useEffect(() => {
        if (!uploadOpen) return;
        uploadCardRef.current?.scrollIntoView({ block: "nearest" });
        typeSelectRef.current?.focus();
    }, [uploadOpen]);

    // After the inline confirm is cancelled, put focus back on that row's
    // trash button once it has re-mounted.
    useEffect(() => {
        if (confirmDeleteId !== null || !restoreFocusId.current) return;
        deleteTriggerRefs.current[restoreFocusId.current]?.focus();
        restoreFocusId.current = null;
    }, [confirmDeleteId]);

    const openUpload = () => {
        setUploadError("");
        setUploadOpen(true);
    };

    const cancelDelete = (docId: string) => {
        restoreFocusId.current = docId;
        setConfirmDeleteId(null);
    };

    const closeUpload = () => {
        setUploadOpen(false);
        setUploadError("");
        setFile(null);
        setDragActive(false);
    };

    const clearFile = () => {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !patient || (!patient.id && !patient.patientId)) return;

        setUploading(true);
        setUploadError("");
        try {
            const patientCode = patient.id || patient.patientId;
            await uploadPatientDocument(patientCode as string, documentType, file, description);
            setUploadOpen(false);
            setFile(null);
            setDescription("");
            setDocumentType("LAB_REPORT_INTERNAL");
            toast.success("Document uploaded.");
            loadDocuments(0); // Refresh the list
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Upload failed", err);
            setUploadError(err.response?.data?.message || "Couldn't upload the document. Try again.");
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (docId: string, fileName: string) => {
        if (!patient || (!patient.id && !patient.patientId)) return;
        const patientCode = patient.id || patient.patientId;
        try {
            const url = await downloadPatientDocument(patientCode as string, docId);
            // Simulate clicking the presigned URL
            if (url) {
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error("Download failed", error);
            toast.error("Failed to download document.");
        }
    };

    const handleDelete = async (docId: string) => {
        if (!patient || (!patient.id && !patient.patientId)) return;
        const patientCode = patient.id || patient.patientId;
        setDeletingId(docId);
        try {
            await deletePatientDocument(patientCode as string, docId);
            toast.success("Document deleted.");
            setConfirmDeleteId(null);
            // The focused Delete button is about to unmount with its row —
            // land focus on the list container instead of <body>.
            listRef.current?.focus();
            // If that was the last row on this page, step back a page.
            const nextPage = documents.length === 1 && page > 0 ? page - 1 : page;
            loadDocuments(nextPage);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Delete failed", err);
            toast.error(err.response?.data?.message || "Couldn't delete the document. Try again.");
        } finally {
            setDeletingId(null);
        }
    };

    if (!patient) return null;

    const showList = !loading && !loadError && documents.length > 0;

    return (
        <div className="space-y-4">
            {/* Screen-reader status for async state */}
            <p role="status" aria-live="polite" className="sr-only">
                {uploading
                    ? "Uploading document"
                    : loading
                      ? "Loading documents"
                      : loadError
                        ? "Documents could not be loaded"
                        : `${totalElements} document${totalElements === 1 ? "" : "s"} loaded`}
            </p>

            {/* ── Upload card (dropzone) ── */}
            {uploadOpen && (
                <div ref={uploadCardRef} className="scroll-mt-24">
                    <SectionCard
                        title="Upload document"
                        actions={
                            <Button variant="ghost" size="sm" icon={X} aria-label="Close upload form" onClick={closeUpload} />
                        }
                    >
                        <form onSubmit={handleUpload} aria-busy={uploading} className="space-y-4">
                            {uploadError && (
                                <div
                                    role="alert"
                                    className="flex items-start gap-2 rounded-md border border-status-danger-edge bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
                                >
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <SelectField
                                    ref={typeSelectRef}
                                    label="Document type"
                                    required
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                >
                                    {DOCUMENT_TYPE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </SelectField>
                                <InputField
                                    label="Description"
                                    type="text"
                                    placeholder="E.g. Dr Silva's prescription, 20 Jan"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    hint="Optional — shown under the file name."
                                />
                            </div>

                            {/* Dropzone: the real file input stays (sr-only) and is the focus target */}
                            <div>
                                <p className="mb-1 text-xs font-medium text-fg-secondary">
                                    File
                                    <span className="ml-0.5 text-status-danger-fg" aria-hidden="true">
                                        *
                                    </span>
                                </p>
                                <div
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragActive(true);
                                    }}
                                    onDragLeave={(e) => {
                                        // Only clear when actually leaving the zone, not when
                                        // crossing into one of its children.
                                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragActive(false);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragActive(false);
                                        const dropped = e.dataTransfer.files?.[0];
                                        if (!dropped) return;
                                        // Push the dropped FileList into the real (required) input so
                                        // native constraint validation lets the form submit.
                                        if (fileInputRef.current) fileInputRef.current.files = e.dataTransfer.files;
                                        setFile(dropped);
                                    }}
                                    className={cn(
                                        "relative flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
                                        "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1 focus-within:ring-offset-surface",
                                        dragActive ? "border-primary bg-primary-soft" : "border-edge-strong bg-surface-muted hover:bg-surface-hover"
                                    )}
                                >
                                    <Upload className="h-5 w-5 text-fg-faint" aria-hidden="true" />
                                    <label htmlFor={fileInputId} className="cursor-pointer text-sm text-fg-secondary">
                                        <span className="font-medium text-primary-strong hover:underline">Choose a file</span> or drag it here
                                    </label>
                                    <input
                                        id={fileInputId}
                                        ref={fileInputRef}
                                        type="file"
                                        required
                                        className="sr-only"
                                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                    {file ? (
                                        <p className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md border border-edge bg-surface px-2 py-1 text-xs text-fg">
                                            <FileText className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                                            <span className="min-w-0 truncate font-medium">{file.name}</span>
                                            <span className="shrink-0 tabular-nums text-fg-muted">{formatFileSize(file.size)}</span>
                                            <button
                                                type="button"
                                                onClick={clearFile}
                                                aria-label={`Remove ${file.name}`}
                                                className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            >
                                                <X className="h-3 w-3" aria-hidden="true" />
                                            </button>
                                        </p>
                                    ) : (
                                        <p className="text-xs text-fg-muted">One file per upload.</p>
                                    )}
                                </div>
                            </div>

                            {/* Bottom action bar */}
                            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-edge pt-4">
                                <Button type="button" variant="secondary" onClick={closeUpload} disabled={uploading}>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" icon={Upload} loading={uploading} disabled={!file}>
                                    Upload
                                </Button>
                            </div>
                        </form>
                    </SectionCard>
                </div>
            )}

            {/* ── Documents list ── */}
            <SectionCard
                title="Documents"
                count={loading || loadError ? undefined : totalElements}
                flush
                actions={
                    !uploadOpen ? (
                        <Button variant="primary" size="sm" icon={Upload} onClick={openUpload}>
                            Upload document
                        </Button>
                    ) : undefined
                }
            >
                <div ref={listRef} tabIndex={-1} aria-busy={loading} className="focus:outline-none">
                    {loading ? (
                        <ul aria-hidden="true" className="divide-y divide-edge">
                            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-3">
                                    <span className="h-7 w-7 shrink-0 rounded-md bg-skeleton" />
                                    <span className="flex-1 space-y-1.5">
                                        <span className="block h-3 w-48 max-w-full rounded bg-skeleton" />
                                        <span className="block h-2.5 w-24 rounded bg-skeleton" />
                                    </span>
                                    <span className="hidden h-4 w-20 rounded bg-skeleton sm:block" />
                                    <span className="hidden h-3 w-16 rounded bg-skeleton md:block" />
                                    <span className="h-7 w-14 rounded bg-skeleton" />
                                </li>
                            ))}
                        </ul>
                    ) : loadError ? (
                        <EmptyState
                            icon={AlertTriangle}
                            title="Couldn't load documents"
                            description={loadError}
                            action={
                                <Button size="sm" onClick={() => loadDocuments(page)}>
                                    Retry
                                </Button>
                            }
                        />
                    ) : documents.length === 0 ? (
                        <EmptyState
                            icon={FolderOpen}
                            title="No documents yet"
                            description="Upload a lab report, prescription or consent form for this patient."
                            action={
                                <Button size="sm" icon={Upload} onClick={openUpload}>
                                    Upload document
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            {/* table-fixed arithmetic: the % columns resolve against the table's own
                                width, and the actions column is a hard 120px.
                                base (Uploaded by hidden): 34+16+9+13 = 72% -> 0.72*720 + 120 = 638 <= 720 OK.
                                lg  (Uploaded by shown):   +14% = 86% -> needs 0.86W + 120 <= W, i.e. W >= 857px,
                                so the min width steps up to 880px when that column appears. */}
                            <table className="w-full min-w-[720px] table-fixed text-left text-[13px] lg:min-w-[880px]">
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                        <th scope="col" className="w-[34%] py-2 pl-4 pr-3 font-medium">Document</th>
                                        <th scope="col" className="w-[16%] px-3 py-2 font-medium">Type</th>
                                        <th scope="col" className="w-[9%] px-3 py-2 font-medium">Size</th>
                                        <th scope="col" className="w-[13%] px-3 py-2 font-medium">Uploaded</th>
                                        <th scope="col" className="hidden w-[14%] px-3 py-2 font-medium lg:table-cell">Uploaded by</th>
                                        <th scope="col" className="w-[120px] py-2 pl-3 pr-4 text-right font-medium">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {documents.map((doc) => {
                                        const Icon = fileIcon(doc.contentType, doc.originalFileName);
                                        const typeLabel = documentTypeLabel(doc.documentType);
                                        const uploadedBy = doc.uploadedBy || "System";
                                        const uploadedAt = toDate(doc.uploadedAt);
                                        const confirming = confirmDeleteId === doc.documentId;
                                        const deleting = deletingId === doc.documentId;
                                        return (
                                            <tr key={doc.documentId} className="transition-colors hover:bg-surface-hover">
                                                <td className="py-2 pl-4 pr-3">
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <span
                                                            aria-hidden="true"
                                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-fg-muted"
                                                        >
                                                            <Icon className="h-4 w-4" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium text-fg" title={doc.originalFileName}>
                                                                {doc.originalFileName}
                                                            </p>
                                                            {doc.description && (
                                                                <p className="truncate text-xs text-fg-muted" title={doc.description}>
                                                                    {doc.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span
                                                        title={typeLabel}
                                                        className="inline-block max-w-full truncate rounded-full bg-surface-muted px-2 py-0.5 align-middle text-[11px] font-medium text-fg-secondary ring-1 ring-inset ring-edge"
                                                    >
                                                        {typeLabel}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 tabular-nums text-fg-secondary">{formatFileSize(doc.fileSize)}</td>
                                                <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                                    <time dateTime={doc.uploadedAt} title={uploadedAt ? uploadedAt.toLocaleString() : undefined}>
                                                        {formatRegistered(uploadedAt)}
                                                    </time>
                                                </td>
                                                <td className="hidden px-3 py-2 lg:table-cell">
                                                    <p className="truncate text-fg-secondary" title={uploadedBy}>{uploadedBy}</p>
                                                    {doc.uploadedBranch && (
                                                        <p className="truncate text-xs text-fg-muted" title={doc.uploadedBranch}>
                                                            {doc.uploadedBranch}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-2 pl-3 pr-4 text-right">
                                                    {canDelete && confirming ? (
                                                        <div className="flex items-center justify-end gap-1.5" role="group" aria-label={`Confirm delete ${doc.originalFileName}`}>
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                loading={deleting}
                                                                onClick={() => handleDelete(doc.documentId)}
                                                            >
                                                                Delete
                                                            </Button>
                                                            {/* Focus lands on Cancel (not the destructive button) so a stray Enter/Space is safe. */}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={X}
                                                                aria-label="Cancel delete"
                                                                disabled={deleting}
                                                                onClick={() => cancelDelete(doc.documentId)}
                                                                autoFocus
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={Download}
                                                                aria-label={`Download ${doc.originalFileName}`}
                                                                title="Download"
                                                                onClick={() => handleDownload(doc.documentId, doc.originalFileName)}
                                                            />
                                                            {canDelete && (
                                                                <Button
                                                                    ref={(el) => {
                                                                        deleteTriggerRefs.current[doc.documentId] = el;
                                                                    }}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    icon={Trash2}
                                                                    aria-label={`Delete ${doc.originalFileName}`}
                                                                    title="Delete"
                                                                    className="hover:text-status-danger-fg"
                                                                    onClick={() => setConfirmDeleteId(doc.documentId)}
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer / pagination */}
                    {showList && totalElements > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2 text-xs text-fg-muted">
                            <span className="tabular-nums">
                                Page {page + 1} of {totalPages} · {totalElements} document{totalElements === 1 ? "" : "s"}
                            </span>
                            {totalPages > 1 && (
                                <nav aria-label="Documents pagination" className="flex items-center gap-1.5">
                                    <Button size="sm" icon={ChevronLeft} disabled={page === 0} onClick={() => loadDocuments(page - 1)}>
                                        Previous
                                    </Button>
                                    <Button size="sm" disabled={page === totalPages - 1} onClick={() => loadDocuments(page + 1)}>
                                        Next
                                        <ChevronRight aria-hidden="true" />
                                    </Button>
                                </nav>
                            )}
                        </div>
                    )}
                </div>
            </SectionCard>
        </div>
    );
}
