package com.uom.lims.simulator.analyzer;

import java.util.List;

/**
 * A simulated analyzer model and the panel of analytes it reports.
 *
 * <p>The two profiles match the team's current live scope (full blood count and
 * urea/electrolytes). Reference and critical ranges are typical adult values
 * with LOINC codes so the integration middleware can map device results to the
 * LIS test catalogue. These are simulation defaults — a production deployment
 * sources ranges from the LIS reference-range engine, not the analyzer.
 */
public enum AnalyzerProfile {

    /** Hematology analyzer — Full Blood Count (Sysmex XN-series style). */
    HEMATOLOGY("Sysmex XN-550 (simulated)", "HEM-SIM-01", "FBC", "Full Blood Count", "Whole Blood EDTA",
            List.of(
                    new Analyte("WBC", "White Cell Count", "6690-2", "10*9/L", 4.0, 11.0, 2.0, 30.0, 1),
                    new Analyte("RBC", "Red Cell Count", "789-8", "10*12/L", 4.5, 5.9, 2.5, 7.0, 2),
                    new Analyte("HGB", "Haemoglobin", "718-7", "g/dL", 13.0, 17.0, 7.0, 20.0, 1),
                    new Analyte("HCT", "Haematocrit", "4544-3", "%", 40.0, 50.0, 20.0, 60.0, 1),
                    new Analyte("MCV", "Mean Cell Volume", "787-2", "fL", 80.0, 100.0, 60.0, 120.0, 1),
                    new Analyte("PLT", "Platelet Count", "777-3", "10*9/L", 150.0, 400.0, 50.0, 1000.0, 0)
            )),

    /** Chemistry analyzer — Urea & Electrolytes (Roche Cobas style). */
    CHEMISTRY("Roche Cobas c311 (simulated)", "CHEM-SIM-01", "UE", "Urea & Electrolytes", "Serum",
            List.of(
                    new Analyte("UREA", "Urea", "22664-7", "mmol/L", 2.5, 7.1, 1.0, 30.0, 1),
                    new Analyte("CREA", "Creatinine", "2160-0", "umol/L", 60.0, 110.0, 20.0, 600.0, 0),
                    new Analyte("NA", "Sodium", "2951-2", "mmol/L", 135.0, 145.0, 120.0, 160.0, 0),
                    new Analyte("K", "Potassium", "2823-3", "mmol/L", 3.5, 5.1, 2.8, 6.2, 1),
                    new Analyte("CL", "Chloride", "2075-0", "mmol/L", 98.0, 107.0, 80.0, 120.0, 0)
            ));

    private final String model;
    private final String instrumentId;
    private final String panelCode;
    private final String panelName;
    private final String specimenType;
    private final List<Analyte> analytes;

    AnalyzerProfile(String model, String instrumentId, String panelCode, String panelName,
                    String specimenType, List<Analyte> analytes) {
        this.model = model;
        this.instrumentId = instrumentId;
        this.panelCode = panelCode;
        this.panelName = panelName;
        this.specimenType = specimenType;
        this.analytes = analytes;
    }

    public String model() {
        return model;
    }

    public String instrumentId() {
        return instrumentId;
    }

    public String panelCode() {
        return panelCode;
    }

    public String panelName() {
        return panelName;
    }

    public String specimenType() {
        return specimenType;
    }

    public List<Analyte> analytes() {
        return analytes;
    }

    public static AnalyzerProfile fromArg(String arg) {
        if (arg == null) {
            return HEMATOLOGY;
        }
        return switch (arg.trim().toUpperCase()) {
            case "CHEMISTRY", "CHEM", "UE", "UREA" -> CHEMISTRY;
            default -> HEMATOLOGY;
        };
    }
}
