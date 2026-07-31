package com.uom.lims.interop;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class Hl7OruBuilderTest {

    @Test
    void buildsAWellFormedOruMessage() {
        var patient = new Hl7OruBuilder.Patient("PAT00042", "Perera", "Nimal", "19900202", "M");
        var obs = List.of(
                new Hl7OruBuilder.Observation("718-7", "Haemoglobin", "14.8", "g/dL", "13.0", "17.0", "N", true),
                new Hl7OruBuilder.Observation("777-3", "Platelet Count", "95", "10*9/L", "150", "400", "LL", true));

        String msg = Hl7OruBuilder.build("MSG123", "20260530120000", patient,
                "S20260530-00001", "58410-2", "Full Blood Count", obs);

        String[] segments = msg.split("\r");
        assertEquals("MSH", segments[0].substring(0, 3));
        assertTrue(segments[0].contains("ORU^R01"));
        assertTrue(segments[0].contains("2.5.1"));
        assertEquals("PID", segments[1].substring(0, 3));
        assertTrue(segments[1].contains("Perera^Nimal"));
        assertEquals("OBR", segments[2].substring(0, 3));
        assertTrue(segments[2].contains("58410-2"));
        // Two OBX result segments
        assertEquals("OBX", segments[3].substring(0, 3));
        assertTrue(segments[3].contains("718-7^Haemoglobin^LN"));
        assertTrue(segments[3].contains("13.0-17.0"));
        assertTrue(segments[4].contains("777-3"));
        assertTrue(segments[4].endsWith("LL|||F"));
    }

    @Test
    void escapesHl7DelimitersInData() {
        var patient = new Hl7OruBuilder.Patient("PAT1", "O^Brien", "Jr|Sr", "19900202", "M");
        var obs = List.of(
                new Hl7OruBuilder.Observation("718-7", "Haemoglobin", "14.8", "g/dL", "13.0", "17.0", "N", true));
        String msg = Hl7OruBuilder.build("M1", "20260530120000", patient, "S1", "58410-2", "FBC", obs);
        String pid = msg.split("\r")[1];
        // ^ and | inside the name are escaped, leaving the PID-5 component separator intact.
        assertTrue(pid.contains("O\\S\\Brien^Jr\\F\\Sr"), pid);
    }

    @Test
    void mapsAbnormalFlags() {
        assertEquals("LL", Hl7OruBuilder.hl7Flag("CRITICAL_LOW"));
        assertEquals("HH", Hl7OruBuilder.hl7Flag("CRITICAL_HIGH"));
        assertEquals("H", Hl7OruBuilder.hl7Flag("HIGH"));
        assertEquals("N", Hl7OruBuilder.hl7Flag("NORMAL"));
    }
}
