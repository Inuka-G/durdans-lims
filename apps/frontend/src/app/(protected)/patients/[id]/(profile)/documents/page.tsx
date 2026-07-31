"use client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { usePatient } from "../../PatientProvider";
import { getPatientDocuments, uploadPatientDocument, downloadPatientDocument } from "@/lib/api";
import type { PatientDocument } from "@/lib/api";

export default function PatientDocumentsTab() {
    const { patient } = usePatient();

    const [documents, setDocuments] = useState<PatientDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState("LAB_REPORT_INTERNAL");
    const [description, setDescription] = useState("");

    const loadDocuments = useCallback(async (pageIndex: number = 0) => {
        if (!patient || (!patient.id && !patient.patientId)) return;
        const patientCode = patient.id || patient.patientId;

        setLoading(true);
        try {
            const data = await getPatientDocuments(patientCode as string, { page: pageIndex, size: 10 });
            setDocuments(data.content || []);
            setTotalPages(data.totalPages || 1);
            setTotalElements(data.totalElements || 0);
            setPage(pageIndex);
        } catch (error) {
            console.error("Failed to load documents", error);
        } finally {
            setLoading(false);
        }
    }, [patient]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !patient || (!patient.id && !patient.patientId)) return;

        setUploading(true);
        setUploadError("");
        try {
            const patientCode = patient.id || patient.patientId;
            await uploadPatientDocument(patientCode as string, documentType, file, description);
            setShowUploadModal(false);
            setFile(null);
            setDescription("");
            setDocumentType("LAB_REPORT_INTERNAL");
            loadDocuments(0); // Refresh the list
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Upload failed", err);
            setUploadError(err.response?.data?.message || "Failed to upload document.");
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

    if (!patient) return null;

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'LAB_REPORT_INTERNAL':
            case 'LAB_REPORT_EXTERNAL': return 'bg-purple-50 text-purple-600 border-purple-100';
            case 'PRESCRIPTION': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'ID_VERIFICATION': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'MEDICAL_HISTORY': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'INSURANCE_DOCUMENT': return 'bg-cyan-50 text-cyan-600 border-cyan-100';
            case 'CONSENT_FORM': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-amber-50 text-amber-600 border-amber-100';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'PRESCRIPTION': return 'vaccines';
            case 'LAB_REPORT_INTERNAL':
            case 'LAB_REPORT_EXTERNAL': return 'science';
            case 'ID_VERIFICATION': return 'badge';
            case 'MEDICAL_HISTORY': return 'history_edu';
            case 'INSURANCE_DOCUMENT': return 'verified_user';
            case 'CONSENT_FORM': return 'assignment_turned_in';
            default: return 'description';
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8 relative">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-wrap gap-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-icons text-primary text-xl">folder_shared</span>
                    Patient Documents
                </h3>
                <div className="flex gap-2">
                    <button className="border border-slate-200 bg-white text-slate-600 px-3 py-2 rounded text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 transition-colors">
                        <span className="material-icons text-sm">filter_list</span>
                        Filter
                    </button>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-colors"
                    >
                        <span className="material-icons text-sm">cloud_upload</span>
                        Upload New
                    </button>
                </div>
            </div>

            {/* Upload Modal (Simplified Inline Overlay) */}
            {showUploadModal && (
                <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm p-6 overflow-y-auto border-b border-slate-100 flex flex-col items-center justify-center">
                    <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-900 text-lg">Upload Document</h4>
                            <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        {uploadError && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
                                {uploadError}
                            </div>
                        )}
                        <form onSubmit={handleUpload}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Document Type *</label>
                                    <select
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900"
                                        value={documentType}
                                        onChange={(e) => setDocumentType(e.target.value)}
                                        required
                                    >
                                        <option value="LAB_REPORT_INTERNAL">Internal Lab Report</option>
                                        <option value="LAB_REPORT_EXTERNAL">External Lab Report</option>
                                        <option value="PRESCRIPTION">Prescription</option>
                                        <option value="MEDICAL_HISTORY">Medical History</option>
                                        <option value="ID_VERIFICATION">ID Verification</option>
                                        <option value="INSURANCE_DOCUMENT">Insurance Document</option>
                                        <option value="CONSENT_FORM">Consent Form</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900"
                                        placeholder="E.g., Dr. Silva's Prescription from Jan 20"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">File *</label>
                                    <input
                                        type="file"
                                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
                                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                        required
                                    />
                                </div>
                                <div className="pt-2 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowUploadModal(false)}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={uploading || !file}
                                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
                                    >
                                        {uploading && <span className="material-icons animate-spin text-sm">sync</span>}
                                        Upload
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                            <th className="px-6 py-4 border-b border-slate-100">Document Name</th>
                            <th className="px-6 py-4 border-b border-slate-100">Type &amp; Size</th>
                            <th className="px-6 py-4 border-b border-slate-100">Uploaded Date</th>
                            <th className="px-6 py-4 border-b border-slate-100">Uploaded By</th>
                            <th className="px-6 py-4 border-b border-slate-100 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                                    <span className="material-icons animate-spin text-primary text-2xl mb-2">sync</span>
                                    <p>Loading documents...</p>
                                </td>
                            </tr>
                        ) : documents.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                                    <span className="material-icons text-slate-300 text-4xl mb-2">folder_off</span>
                                    <p>No documents found for this patient.</p>
                                </td>
                            </tr>
                        ) : (
                            documents.map((doc) => (
                                <tr key={doc.documentId} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="material-icons text-slate-400">{getIcon(doc.documentType)}</span>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{doc.originalFileName}</p>
                                                {doc.description && <p className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate">{doc.description}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded tracking-wider border ${getTypeColor(doc.documentType)}`}>
                                                {doc.documentType.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">{formatFileSize(doc.fileSize)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                        {new Date(doc.uploadedAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        <p className="font-medium text-slate-700">{doc.uploadedBy || "System"}</p>
                                        <p className="text-[10px]">{doc.uploadedBranch || "Main Branch"}</p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button
                                                onClick={() => handleDownload(doc.documentId, doc.originalFileName)}
                                                className="text-slate-400 hover:text-primary transition-colors flex items-center pr-2"
                                                title="Download Document"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">file_download</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {!loading && totalElements > 0 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500">Showing page {page + 1} of {totalPages} ({totalElements} documents)</p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => loadDocuments(page - 1)}
                            className="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90">{page + 1}</button>
                        <button
                            disabled={page === totalPages - 1}
                            onClick={() => loadDocuments(page + 1)}
                            className="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
