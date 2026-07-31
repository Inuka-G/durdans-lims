package com.uom.lims.interop;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds a FHIR R4 {@code Bundle} (collection) containing a DiagnosticReport and
 * its Observation resources for transmission to a FHIR-capable EHR. Observations
 * carry LOINC codes, UCUM units, reference ranges and v3 interpretation flags.
 *
 * <p>Hand-built with Jackson (no FHIR SDK dependency) — sufficient for outbound
 * result reporting; adopt HAPI FHIR if full resource validation/profiles are needed.
 */
public final class FhirResultBuilder {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String LOINC = "http://loinc.org";
    private static final String UCUM = "http://unitsofmeasure.org";
    private static final String INTERP = "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

    private FhirResultBuilder() {
    }

    public static String build(Hl7OruBuilder.Patient patient, String panelLoinc, String panelName,
                               List<Hl7OruBuilder.Observation> observations) {
        List<Map<String, Object>> entries = new ArrayList<>();
        List<Map<String, Object>> resultRefs = new ArrayList<>();

        int i = 0;
        for (Hl7OruBuilder.Observation o : observations) {
            String obsId = "obs-" + (++i);
            entries.add(Map.of("resource", observation(obsId, patient.id(), o)));
            resultRefs.add(Map.of("reference", "Observation/" + obsId));
        }

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("resourceType", "DiagnosticReport");
        report.put("status", "final");
        report.put("code", codeableConcept(panelLoinc, panelName));
        report.put("subject", Map.of("reference", "Patient/" + patient.id()));
        report.put("result", resultRefs);

        List<Map<String, Object>> allEntries = new ArrayList<>();
        allEntries.add(Map.of("resource", report));
        allEntries.addAll(entries);

        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("resourceType", "Bundle");
        bundle.put("type", "collection");
        bundle.put("entry", allEntries);

        try {
            return MAPPER.writeValueAsString(bundle);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize FHIR bundle", e);
        }
    }

    private static Map<String, Object> observation(String id, String patientId, Hl7OruBuilder.Observation o) {
        Map<String, Object> obs = new LinkedHashMap<>();
        obs.put("resourceType", "Observation");
        obs.put("id", id);
        obs.put("status", "final");
        obs.put("code", codeableConcept(o.loinc(), o.name()));
        obs.put("subject", Map.of("reference", "Patient/" + patientId));

        if (o.numeric() && o.value() != null && !o.value().isBlank()) {
            obs.put("valueQuantity", Map.of(
                    "value", new BigDecimal(o.value()),
                    "unit", nz(o.unit()),
                    "system", UCUM));
        } else {
            obs.put("valueString", nz(o.value()));
        }

        if (notBlank(o.refLow()) || notBlank(o.refHigh())) {
            Map<String, Object> range = new LinkedHashMap<>();
            if (notBlank(o.refLow())) {
                range.put("low", Map.of("value", new BigDecimal(o.refLow()), "unit", nz(o.unit())));
            }
            if (notBlank(o.refHigh())) {
                range.put("high", Map.of("value", new BigDecimal(o.refHigh()), "unit", nz(o.unit())));
            }
            obs.put("referenceRange", List.of(range));
        }

        String interp = interpretationCode(o.flag());
        if (!interp.isEmpty()) {
            obs.put("interpretation", List.of(Map.of("coding",
                    List.of(Map.of("system", INTERP, "code", interp)))));
        }
        return obs;
    }

    private static Map<String, Object> codeableConcept(String code, String display) {
        return Map.of("coding", List.of(Map.of(
                "system", LOINC, "code", nz(code), "display", nz(display))));
    }

    /** ASTM/LIMS flag -> v3 ObservationInterpretation code. */
    private static String interpretationCode(String flag) {
        if (flag == null) {
            return "";
        }
        return switch (flag.trim().toUpperCase()) {
            case "L", "LOW" -> "L";
            case "H", "HIGH" -> "H";
            case "LL", "CRITICAL_LOW" -> "LL";
            case "HH", "CRITICAL_HIGH" -> "HH";
            case "N", "NORMAL" -> "N";
            default -> "";
        };
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
