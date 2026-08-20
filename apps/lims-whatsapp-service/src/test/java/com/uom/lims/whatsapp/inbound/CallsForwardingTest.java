package com.uom.lims.whatsapp.inbound;

import com.uom.lims.whatsapp.outbound.DeliveryStatusWriter;
import com.uom.lims.whatsapp.voice.CallsForwarder;
import com.uom.lims.whatsapp.webhook.WebhookPayload;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class CallsForwardingTest {

    @Mock
    private InboundMessageWriter writer;

    @Mock
    private DeliveryStatusWriter statusWriter;

    @Mock
    private CallsForwarder callsForwarder;

    @InjectMocks
    private InboundWebhookService service;

    private static WebhookPayload payloadWithFields(String... fields) {
        List<WebhookPayload.Change> changes = java.util.Arrays.stream(fields)
                .map(field -> new WebhookPayload.Change(field, null))
                .toList();
        return new WebhookPayload("whatsapp_business_account",
                List.of(new WebhookPayload.Entry("waba-id", changes)));
    }

    @Test
    void callEventsForwardTheWholeDeliveryOnce() {
        // Meta can batch multiple call changes into one delivery; the gateway parses
        // the full body, so one forward covers them all.
        assertThat(service.ingest(payloadWithFields("calls", "calls"), "{\"raw\":true}")).isZero();

        verify(callsForwarder, times(1)).forward("{\"raw\":true}");
        verifyNoInteractions(writer);
    }

    @Test
    void messageDeliveriesNeverTouchTheForwarder() {
        assertThat(service.ingest(payloadWithFields("messages"), "{}")).isZero();

        verifyNoInteractions(callsForwarder);
    }
}
