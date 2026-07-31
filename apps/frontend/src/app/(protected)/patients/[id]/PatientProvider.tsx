"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { getPatientById, Patient } from "@/lib/api";

interface PatientContextType {
    patient: Patient | null;
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
}

const PatientContext = createContext<PatientContextType>({
    patient: null,
    loading: true,
    error: "",
    refresh: async () => { },
});

export function PatientProvider({ children, id }: { children: ReactNode, id: string }) {
    const [patient, setPatient] = useState<Patient | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchPatient = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPatientById(id);
            setPatient(data);
            setError("");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Failed to load patient", err);
            setError(err.response?.data?.message || "Failed to load patient profile.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchPatient();
        }
    }, [id, fetchPatient]);

    return (
        <PatientContext.Provider value={{ patient, loading, error, refresh: fetchPatient }}>
            {children}
        </PatientContext.Provider>
    );
}

export const usePatient = () => useContext(PatientContext);
