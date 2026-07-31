package com.uom.lims.interop;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class Hl7InboundParserTest {

    @Test
    void parsesAnOrmOrderMessage() {
        String orm = "MSH|^~\\&|HIS|DURDANS|LIS|DURDANS|20260530120000||ORM^O01|MSG1|P|2.5.1\r"
                + "PID|1||PAT00042||Perera^Nimal||19900202|M\r"
                + "ORC|NW|ORD123\r"
                + "OBR|1|ORD123||58410-2^Full Blood Count^LN";

        Hl7InboundParser.InMessage msg = Hl7InboundParser.parse(orm);

        assertEquals("ORM", msg.messageType());
        assertEquals("PAT00042", msg.patient().id());
        assertEquals("Perera", msg.patient().lastName());
        assertEquals("Nimal", msg.patient().firstName());
        assertEquals("M", msg.patient().sex());

        assertEquals(1, msg.orders().size());
        assertEquals("58410-2", msg.orders().get(0).serviceCode());
        assertEquals("Full Blood Count", msg.orders().get(0).serviceName());
    }
}
