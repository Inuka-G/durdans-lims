package com.uom.lims.whatsapp.reply;

import com.uom.lims.whatsapp.config.MetaProperties;
import com.uom.lims.whatsapp.outbound.OutboundMessageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoResponderTest {

    private static final MetaProperties SEND_CONFIGURED = new MetaProperties(
            "app-id", "app-secret", "verify", "12345", "waba", "token", null, null);

    private static final MetaProperties SEND_UNCONFIGURED = new MetaProperties(
            "app-id", "app-secret", "verify", "12345", "waba", "", null, null);

    @Mock
    private OutboundMessageService outbound;

    private static InboundMessageStoredEvent event(UUID conversationId) {
        return new InboundMessageStoredEvent(
                UUID.randomUUID(), conversationId, "94770000002", "hello", "text");
    }

    @Test
    void doesNothingWhenDisabled() {
        AutoResponder responder = new AutoResponder(
                new AutoReplyProperties(false, Duration.ofHours(1), null), SEND_CONFIGURED, outbound);

        responder.onInboundStored(event(UUID.randomUUID()));

        verifyNoInteractions(outbound);
    }

    @Test
    void failsClosedWhenSendCredentialsAreMissing() {
        AutoResponder responder = new AutoResponder(
                new AutoReplyProperties(true, Duration.ofHours(1), null), SEND_UNCONFIGURED, outbound);

        responder.onInboundStored(event(UUID.randomUUID()));

        verifyNoInteractions(outbound);
    }

    @Test
    void delegatesWithTheConfiguredGreetingAndCooldown() {
        AutoReplyProperties properties = new AutoReplyProperties(true, Duration.ofMinutes(30), "custom greeting");
        AutoResponder responder = new AutoResponder(properties, SEND_CONFIGURED, outbound);
        UUID conversationId = UUID.randomUUID();
        when(outbound.sendAutoReplyIfDue(conversationId, "custom greeting", Duration.ofMinutes(30)))
                .thenReturn(Optional.empty());

        responder.onInboundStored(event(conversationId));

        verify(outbound).sendAutoReplyIfDue(conversationId, "custom greeting", Duration.ofMinutes(30));
    }
}
