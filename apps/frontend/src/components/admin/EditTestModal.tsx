import { useState, useEffect } from "react";

interface EditTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    testData?: {
        code: string;
        name: string;
        category: string;
        price: string;
        isActive: boolean;
    } | null;
}

export default function EditTestModal({ isOpen, onClose, testData }: EditTestModalProps) {
    const [formData, setFormData] = useState({
        testName: "",
        testCode: "",
        category: "Haematology",
        basePrice: "",
        urgentSurcharge: "25", // mockup value matching screenshot
        referenceRange: "Adult Male: 13.5-17.5 g/dL\nAdult Female: 12.0-15.5 g/dL", // mockup
        measurementUnits: "g/dL", // mockup
        sampleType: "Whole Blood (EDTA)", // mockup
        isActive: true
    });

    useEffect(() => {
        if (testData) {
            // Strip formatting from price to get numeric value
            const numericPrice = testData.price.replace(/,/g, '').split('.')[0];

            setFormData(prev => ({
                ...prev,
                testName: testData.name,
                testCode: testData.code,
                category: testData.category,
                basePrice: numericPrice,
                isActive: testData.isActive,
                // Mock specific fields based on exact screenshot if it's the FBC test, otherwise keep defaults
                referenceRange: testData.code === "T-FBC-001" ? "Adult Male: 13.5-17.5 g/dL\nAdult Female: 12.0-15.5 g/dL" : prev.referenceRange,
                measurementUnits: testData.code === "T-FBC-001" ? "g/dL" : prev.measurementUnits,
                sampleType: testData.code === "T-FBC-001" ? "Whole Blood (EDTA)" : prev.sampleType,
            }));
        }
    }, [testData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Saving test changes:", formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] overflow-hidden flex flex-col font-sans"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 bg-white shadow-sm relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/50 shadow-sm">
                            <span className="material-icons text-[22px]">edit_note</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-extrabold text-[#1a2b4b] tracking-tight leading-tight">Edit Laboratory Test</h2>
                            <p className="text-[12px] font-medium text-slate-500 mt-0.5">Update master data for specific clinical tests</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Active Status Toggle in Header */}
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Active Status</span>
                            <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, isActive: !p.isActive }))}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1277E1]/30 ${formData.isActive ? 'bg-[#1277E1]' : 'bg-slate-200'}`}
                                role="switch"
                                aria-checked={formData.isActive}
                            >
                                <span className={`pointer-events-none absolute left-0 inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out border border-slate-200/50 ${formData.isActive ? 'translate-x-[22px] border-transparent' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200/50"
                        >
                            <span className="material-icons text-[20px] block">close</span>
                        </button>
                    </div>
                </div>

                {/* Form Body - Scrollable */}
                <div className="overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
                    <form id="edit-test-form" onSubmit={handleSubmit} className="p-7 flex flex-col gap-8">

                        {/* SECTION 1: BASIC DETAILS */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-4 bg-[#1277E1] rounded-full"></div>
                                <h3 className="text-[14px] font-extrabold text-[#1a2b4b] uppercase tracking-wide">Basic Details</h3>
                            </div>

                            <div className="flex flex-col gap-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Test Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white border border-slate-200 text-slate-800 text-[14px] font-semibold py-2.5 px-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                        value={formData.testName}
                                        onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Test Code</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50/50 border border-slate-200 text-[#1277E1] text-[14px] font-bold py-2.5 px-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-mono tracking-wide"
                                            value={formData.testCode}
                                            onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Category</label>
                                        <div className="relative">
                                            <select
                                                className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-[14px] font-semibold py-2.5 pl-3.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            >
                                                <option value="Haematology">Haematology</option>
                                                <option value="Biochemistry">Biochemistry</option>
                                                <option value="Immunology">Immunology</option>
                                                <option value="Microbiology">Microbiology</option>
                                            </select>
                                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* SECTION 2: PRICING & BILLING */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                <h3 className="text-[14px] font-extrabold text-[#1a2b4b] uppercase tracking-wide">Pricing & Billing</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Base Price (LKR)</label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-3.5 text-slate-400 font-semibold text-[14px]">Rs.</span>
                                        <input
                                            type="number"
                                            required
                                            className="w-full bg-white border border-slate-200 text-slate-900 text-[15px] font-bold py-2.5 pl-10 pr-9 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                            value={formData.basePrice}
                                            onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col bg-slate-100/80 rounded px-0.5 py-0.5 border border-slate-200">
                                            <span className="material-icons text-[12px] text-slate-400 leading-none cursor-pointer hover:text-slate-600">expand_less</span>
                                            <span className="material-icons text-[12px] text-slate-400 leading-none cursor-pointer hover:text-slate-600">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Urgent Surcharge (%)</label>
                                    <div className="relative flex items-center">
                                        <input
                                            type="number"
                                            className="w-full bg-white border border-slate-200 text-slate-900 text-[15px] font-bold py-2.5 px-3.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                            value={formData.urgentSurcharge}
                                            onChange={(e) => setFormData({ ...formData, urgentSurcharge: e.target.value })}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center bg-slate-100/80 rounded px-1 py-1 border border-slate-200 text-slate-400">
                                            <span className="material-icons text-[14px]">price_change</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* SECTION 3: LABORATORY PARAMETERS */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                                <h3 className="text-[14px] font-extrabold text-[#1a2b4b] uppercase tracking-wide">Laboratory Parameters</h3>
                            </div>

                            <div className="flex flex-col gap-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Reference Range Description</label>
                                    <textarea
                                        rows={3}
                                        className="w-full bg-white border border-slate-200 text-slate-800 text-[13.5px] font-medium py-3 px-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-sm resize-none"
                                        value={formData.referenceRange}
                                        onChange={(e) => setFormData({ ...formData, referenceRange: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Measurement Units</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-slate-200 text-slate-800 text-[14px] font-semibold py-2.5 px-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-sm"
                                            value={formData.measurementUnits}
                                            onChange={(e) => setFormData({ ...formData, measurementUnits: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Sample Type</label>
                                        <div className="relative">
                                            <select
                                                className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-[14px] font-semibold py-2.5 pl-3.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer shadow-sm"
                                                value={formData.sampleType}
                                                onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                                            >
                                                <option value="Whole Blood (EDTA)">Whole Blood (EDTA)</option>
                                                <option value="Serum">Serum</option>
                                                <option value="Plasma">Plasma</option>
                                                <option value="Urine">Urine</option>
                                            </select>
                                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                    </form>
                </div>

                {/* Footer Controls */}
                <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="material-icons text-[14px]">info</span>
                        <span className="text-[11px] italic font-medium">Last updated by Admin on Oct 24, 2023 14:12</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors shadow-sm text-[13px]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="edit-test-form"
                            className="flex items-center gap-2 bg-[#1277E1] hover:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl transition-colors shadow-sm text-[13px]"
                        >
                            <span className="material-icons text-[16px] -ml-1">save</span>
                            Save Changes
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
