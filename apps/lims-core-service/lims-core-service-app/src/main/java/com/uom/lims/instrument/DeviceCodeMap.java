package com.uom.lims.instrument;

import java.util.Map;

/**
 * Maps an analyzer's device test codes to LOINC, the universal identifier the
 * LIS catalogue is keyed on. In production this is per-analyzer configuration
 * (an {@code instrument_channel} table); here it is a static map matching the
 * bundled simulator's analytes so the loop can be demonstrated end-to-end.
 */
public final class DeviceCodeMap {

    private DeviceCodeMap() {
    }

    private static final Map<String, String> DEVICE_CODE_TO_LOINC = Map.ofEntries(
            // Hematology (FBC)
            Map.entry("WBC", "6690-2"),
            Map.entry("RBC", "789-8"),
            Map.entry("HGB", "718-7"),
            Map.entry("HCT", "4544-3"),
            Map.entry("MCV", "787-2"),
            Map.entry("PLT", "777-3"),
            // Chemistry (Urea & Electrolytes)
            Map.entry("UREA", "3094-0"),
            Map.entry("CREA", "2160-0"),
            Map.entry("NA", "2951-2"),
            Map.entry("K", "2823-3"),
            Map.entry("CL", "2075-0"));

    public static String toLoinc(String deviceCode) {
        return deviceCode == null ? null : DEVICE_CODE_TO_LOINC.get(deviceCode.trim().toUpperCase());
    }
}
