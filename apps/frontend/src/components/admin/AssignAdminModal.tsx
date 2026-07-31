import { useState } from "react";

interface AssignAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAdmin?: {
        name: string;
        email: string;
    };
    branchName?: string;
}

// Mock users available for assignment
const MOCK_AVAILABLE_ADMINS = [
    { id: "USR-0812", name: "Sunil Perera", email: "sunil.p@durdans.com", role: "Senior Administrator" },
    { id: "USR-0921", name: "Malini Fonseka", email: "malini.f@durdans.com", role: "Operations Manager" },
    { id: "USR-1044", name: "Kasun Kalhara", email: "kasun.k@durdans.com", role: "Branch Admin" },
    { id: "USR-1102", name: "Dr. Ramesh Silva", email: "ramesh.s@durdans.com", role: "Medical Director" },
];

export default function AssignAdminModal({ isOpen, onClose, currentAdmin = { name: "Arjuna Kariyawasam", email: "arjuna.k@durdans.com" }, branchName = "Colombo Main Branch" }: AssignAdminModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [assigningId, setAssigningId] = useState<string | null>(null);

    if (!isOpen) return null;

    const filteredAdmins = MOCK_AVAILABLE_ADMINS.filter(admin =>
        admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAssign = (adminId: string) => {
        setAssigningId(adminId);
        // Simulate API call delay
        setTimeout(() => {
            console.log(`Assigned admin ${adminId} to ${branchName}`);
            setAssigningId(null);
            onClose();
        }, 800);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-[600px] overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center">
                            <span className="material-icons text-[18px]">manage_accounts</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">Assign Branch Admin</h2>
                            <p className="text-[11px] font-bold text-slate-500">{branchName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                        <span className="material-icons text-[20px]">close</span>
                    </button>
                </div>

                {/* Current Admin Banner */}
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200">
                            <span className="material-icons text-slate-400 text-sm">person</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none mb-1">Current Admin</span>
                            <span className="text-[14px] font-extrabold text-slate-800 leading-none">{currentAdmin.name}</span>
                            <span className="text-[12px] font-medium text-slate-500 mt-0.5">{currentAdmin.email}</span>
                        </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-widest hidden sm:flex">
                        Active Duty
                    </span>
                </div>

                {/* Form Body - Search & List */}
                <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">

                    {/* Search */}
                    <div className="relative">
                        <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-800 font-semibold py-3 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all w-full placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                        />
                    </div>

                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-2">Available Users</h3>

                    <div className="flex flex-col gap-2">
                        {filteredAdmins.length > 0 ? (
                            filteredAdmins.map((admin) => (
                                <div key={admin.id} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between hover:border-slate-200 hover:bg-slate-50/50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                            {admin.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-slate-800 leading-tight">{admin.name}</span>
                                            <span className="text-[11px] font-medium text-slate-500">{admin.role}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAssign(admin.id)}
                                        disabled={assigningId === admin.id}
                                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                    >
                                        {assigningId === admin.id ? (
                                            <>
                                                <span className="material-icons text-[14px] animate-spin">sync</span>
                                                Assigning...
                                            </>
                                        ) : "Assign"}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-[13px] font-medium text-slate-500 bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
                                No users found matching &quot;{searchQuery}&quot;
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
