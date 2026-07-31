package com.uom.lims.instrument;

import com.uom.lims.instrument.astm.AstmInbound;
import com.uom.lims.instrument.astm.AstmMessage;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the middleware decodes the same ASTM wire format the analyzer
 * simulator emits, and that result records map to the right fields.
 */
class AstmInboundTest {

    private static byte[] frame(int fn, String text) {
        char fnChar = (char) ('0' + (fn % 8));
        String cs = AstmInbound.checksum(fnChar, text, AstmInbound.ETX);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(AstmInbound.STX);
        out.write((byte) fnChar);
        for (byte b : text.getBytes(StandardCharsets.US_ASCII)) {
            out.write(b);
        }
        out.write(AstmInbound.ETX);
        for (byte b : cs.getBytes(StandardCharsets.US_ASCII)) {
            out.write(b);
        }
        out.write(AstmInbound.CR);
        out.write(AstmInbound.LF);
        return out.toByteArray();
    }

    @Test
    void decodesAndParsesAnAstmSession() throws IOException {
        ByteArrayOutputStream wire = new ByteArrayOutputStream();
        wire.write(AstmInbound.ENQ);
        wire.writeBytes(frame(1, "H|\\^&|||Sysmex^1.0|||||LIS||P|LIS2-A2|20260530120000"));
        wire.writeBytes(frame(2, "P|1|||PAT00042||Perera^Nimal||19900202|M"));
        wire.writeBytes(frame(3, "O|1|S20260530-00001||^^^FBC^Full Blood Count|R"));
        wire.writeBytes(frame(4, "R|1|^^^HGB^Haemoglobin|14.8|g/dL|13.0 to 17.0|N||F"));
        wire.writeBytes(frame(5, "R|2|^^^PLT^Platelet Count|95|10*9/L|150 to 400|LL||F"));
        wire.writeBytes(frame(6, "L|1|N"));
        wire.write(AstmInbound.EOT);

        List<String> records = AstmInbound.receive(
                new ByteArrayInputStream(wire.toByteArray()), new ByteArrayOutputStream());

        // H, P, O, 2x R, L
        assertEquals(6, records.size());

        List<AstmMessage.SpecimenResults> specimens = AstmMessage.parse(records);
        assertEquals(1, specimens.size());
        AstmMessage.SpecimenResults specimen = specimens.get(0);
        assertEquals("S20260530-00001", specimen.sampleId());
        assertEquals(2, specimen.results().size());

        AstmMessage.Result hgb = specimen.results().get(0);
        assertEquals("HGB", hgb.deviceCode());
        assertEquals("14.8", hgb.value());
        assertEquals("g/dL", hgb.unit());
        assertEquals("N", hgb.flag());

        AstmMessage.Result plt = specimen.results().get(1);
        assertEquals("PLT", plt.deviceCode());
        assertEquals("LL", plt.flag());

        // LOINC mapping resolves the device codes the simulator emits.
        assertEquals("718-7", DeviceCodeMap.toLoinc("HGB"));
        assertEquals("777-3", DeviceCodeMap.toLoinc("PLT"));
    }

    @Test
    void rejectsACorruptedChecksum() throws IOException {
        ByteArrayOutputStream wire = new ByteArrayOutputStream();
        wire.write(AstmInbound.ENQ);
        // A frame with a deliberately wrong checksum should be NAK'd and dropped.
        byte[] good = frame(1, "R|1|^^^HGB^Haemoglobin|14.8|g/dL|13.0 to 17.0|N||F");
        good[good.length - 3] = (byte) 'Z'; // corrupt a checksum char
        wire.writeBytes(good);
        wire.write(AstmInbound.EOT);

        List<String> records = AstmInbound.receive(
                new ByteArrayInputStream(wire.toByteArray()), new ByteArrayOutputStream());
        assertTrue(records.isEmpty(), "corrupted frame must not be accepted");
    }
}
