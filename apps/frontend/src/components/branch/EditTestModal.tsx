import { useState, useEffect } from "react";
import { BranchTest } from "@/lib/api";

interface EditTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (testData: Partial<BranchTest>) => Promise<void>;
    test: BranchTest | null;
}

export default function EditTestModal({ isOpen, onClose, onSave, test }: EditTestModalProps) {
    const [formData, setFormData] = useState<BranchTest>({
        testName: "",
        testCode: "",
        category: "Hematology",
        price: 0,
        turnaroundTime: "",
        unit: "per test",
        referenceRange: "",
        isActive: true
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (test) {
            setFormData({
                testName: test.testName || "",
                testCode: test.testCode || "",
                category: test.category || "Hematology",
                price: test.price || 0,
                turnaroundTime: test.turnaroundTime || "",
                unit: test.unit || "per test",
                referenceRange: test.referenceRange || "",
                isActive: test.isActive ?? true
            });
        }
    }, [test, isOpen]);

    if (!isOpen || !test) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === "price" ? Number(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#1277E1]/10 text-[#1277E1] flex items-center justify-center">
                            <span className="material-icons">edit</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Edit Test Details</h2>
                            <p className="text-xs text-slate-500 font-medium">Update the properties of the selected laboratory test.</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <span className="material-icons text-[20px]">close</span>
                    </button>
                </div>

                {/* Form Body */}
                <form id="editTestForm" onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Test Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="testName"
                                    required
                                    value={formData.testName}
                                    onChange={handleChange}
                                    placeholder="e.g. Full Blood Count"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Test Code
                                </label>
                                <input
                                    type="text"
                                    name="testCode"
                                    value={formData.testCode}
                                    onChange={handleChange}
                                    placeholder="e.g. FBC-01"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium uppercase"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        name="category"
                                        required
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full appearance-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-sm font-semibold text-slate-800"
                                    >
                                        <option value="Hematology">Hematology</option>
                                        <option value="Biochemistry">Biochemistry</option>
                                        <option value="Microbiology">Microbiology</option>
                                        <option value="Serology">Serology</option>
                                        <option value="Pathology">Pathology</option>
                                    </select>
                                    <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Price (LKR) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Turnaround Time
                            </label>
                            <input
                                type="text"
                                name="turnaroundTime"
                                value={formData.turnaroundTime}
                                onChange={handleChange}
                                placeholder="e.g. 2 Hours, 1 Day"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Unit <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="unit"
                                    required
                                    value={formData.unit}
                                    onChange={handleChange}
                                    placeholder="e.g. per test"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Reference Range
                                </label>
                                <input
                                    type="text"
                                    name="referenceRange"
                                    value={formData.referenceRange}
                                    onChange={handleChange}
                                    placeholder="e.g. WBC:4.5-11.0, RBC:4.7-6.1"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl mt-2">
                            <input
                                type="checkbox"
                                id="isActiveEditTest"
                                checked={formData.isActive}
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="w-4 h-4 text-[#1277E1] rounded border-slate-300 focus:ring-[#1277E1]"
                            />
                            <div>
                                <label htmlFor="isActiveEditTest" className="text-sm font-bold text-slate-800 cursor-pointer">
                                    Active Test
                                </label>
                                <p className="text-[11px] text-slate-500 font-medium">Test will be immediately available for ordering.</p>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="editTestForm"
                        disabled={isSaving}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1277E1] hover:bg-[#1277E1]/90 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-[#1277E1]/20 disabled:opacity-50"
                    >
                        {isSaving && <span className="material-icons animate-spin text-[16px]">sync</span>}
                        {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                </div>

            </div>
        </div>
    );
}
