"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPatients, Patient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export default function PatientsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    // A search spans every branch, so results can include patients registered
    // elsewhere. Compare against the caller's own branch to label those rows.
    const { branchCode: myBranch } = useAuth();
    const [searched, setSearched] = useState(false);

    const loadPatients = async (query = "") => {
        setLoading(true);
        setSearched(Boolean(query));
        try {
            // Adjust the params passed based on the backend API requirements
            const data = await getPatients(query ? { keyword: query } : {});
            const patientsList = Array.isArray(data) ? data : data.content || [];

            // Map backend PatientResponse to frontend Patient interface
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mappedPatients = patientsList.map((p: any) => {
                const nameParts = p.fullName ? p.fullName.split(' ') : [];
                return {
                    ...p,
                    id: p.patientCode,
                    firstName: nameParts[0] || '',
                    lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
                    phoneNumber: p.phone,
                };
            });
            setPatients(mappedPatients);
        } catch (error) {
            console.error("Failed to fetch patients", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPatients();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadPatients(searchQuery);
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <nav className="flex text-xs font-medium text-slate-400 mb-2 gap-2 items-center">
                        <span className="hover:text-primary cursor-pointer">Patient Management</span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-slate-600">Search Patients</span>
                    </nav>
                    <h1 className="text-2xl font-bold text-slate-900">Search Patients</h1>
                    <p className="text-slate-500 text-sm mt-1">Locate existing patient records to manage profiles and orders.</p>
                </div>
                <Link
                    href="/patients/new"
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg font-semibold text-sm transition-all"
                >
                    <span className="material-icons text-sm">person_add</span>
                    New Registration
                </Link>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                <form className="flex gap-4" onSubmit={handleSearch}>
                    <div className="relative flex-1">
                        <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-slate-900"
                            placeholder="Search by Patient ID, NIC, Phone Number, or Name"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-8 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-sm shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                    >
                        Search
                    </button>
                </form>
                <div className="mt-4 flex items-center gap-2 text-primary">
                    <span className="material-icons text-base">info</span>
                    <p className="text-sm font-medium italic">
                        Searching covers every branch — check here before registering a new patient.
                        With no search term the list shows your own branch only.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">{searched ? "Search Results" : "My Branch"}</h3>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        Showing {patients.length} results
                        {searched ? " across all branches" : ""}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Patient ID</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">NIC/Passport</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Reg. Date</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-500">
                                        Searching...
                                    </td>
                                </tr>
                            ) : patients.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-500">
                                        {searched
                                            ? "No patients found at any branch."
                                            : "No patients registered at your branch yet — search to find one from another branch."}
                                    </td>
                                </tr>
                            ) : (
                                patients.map((patient: Patient) => (
                                    <tr key={patient.id || patient.patientId} className="hover:bg-slate-50 :bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary border-b border-slate-100">
                                            {patient.patientId || patient.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 border-b border-slate-100">
                                            {patient.firstName} {patient.lastName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 border-b border-slate-100">
                                            {patient.identityNumber || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 border-b border-slate-100">
                                            {patient.phoneNumber || patient.phone || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm border-b border-slate-100">
                                            {patient.branchCode ? (
                                                myBranch && patient.branchCode !== myBranch ? (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-semibold"
                                                        title="Registered at another branch — you can still order tests for this patient"
                                                    >
                                                        <span className="material-icons text-[13px]">alt_route</span>
                                                        {patient.branchCode}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-700">{patient.branchCode}</span>
                                                )
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 border-b border-slate-100">
                                            {new Date(patient.createdAt || Date.now()).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right border-b border-slate-100">
                                            <Link href={`/patients/${patient.id || patient.patientId}`} className="text-primary hover:underline font-semibold flex items-center justify-end gap-1">
                                                View Profile <span className="material-icons text-sm">open_in_new</span>
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-12 flex items-center justify-between text-xs text-slate-400">
                <p>© 2023 Durdans Hospital. All Rights Reserved. Laboratory Management System v2.4.1</p>
            </div>
        </div>
    );
}
