package com.uom.lims.interop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FhirResultBuilderTest {

    @Test
    void buildsAValidFhirBundle() throws Exception {
        var patient = new Hl7OruBuilder.Patient("PAT00042", "Perera", "Nimal", "19900202", "M");
        var obs = List.of(
                new Hl7OruBuilder.Observation("718-7", "Haemoglobin", "14.8", "g/dL", "13.0", "17.0", "N", true));

        String json = FhirResultBuilder.build(patient, "58410-2", "Full Blood Count", obs);
        JsonNode root = new ObjectMapper().readTree(json);

        assertEquals("Bundle", root.get("resourceType").asText());
        JsonNode entries = root.get("entry");
        assertEquals("DiagnosticReport", entries.get(0).get("resource").get("resourceType").asText());

        JsonNode observation = entries.get(1).get("resource");
        assertEquals("Observation", observation.get("resourceType").asText());
        assertEquals("718-7", observation.get("code").get("coding").get(0).get("code").asText());
        assertEquals("http://loinc.org", observation.get("code").get("coding").get(0).get("system").asText());
        assertEquals(14.8, observation.get("valueQuantity").get("value").asDouble(), 0.0001);
        assertTrue(observation.has("referenceRange"));
    }
}
