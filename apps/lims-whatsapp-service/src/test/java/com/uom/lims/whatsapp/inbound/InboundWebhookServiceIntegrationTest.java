package com.uom.lims.whatsapp.inbound;

import com.uom.lims.whatsapp.AbstractIntegrationTest;
import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.WaContactRepository;
import com.uom.lims.whatsapp.domain.WaConversationRepository;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import com.uom.lims.whatsapp.webhook.WebhookPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InboundWebhookServiceIntegrationTest extends AbstractIntegrationTest {

    private static final String WA_ID = "94771234567";

    @Autowired
    private InboundWebhookService service;

    @Autowired
    private WaMessageRepository messageRepository;

    @Autowired
    private WaConversationRepository conversationRepository;

    @Autowired
    private WaContactRepository contactRepository;

    @BeforeEach
    void clean() {
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
        contactRepository.deleteAll();
    }

    private static WebhookPayload textMessage(String wamid, String body, long epochSeconds) {
        WebhookPayload.Message message = new WebhookPayload.Message(
                wamid, WA_ID, String.valueOf(epochSeconds), "text",
                new WebhookPayload.Text(body), null, null);
        return wrap(message);
    }

    private static WebhookPayload wrap(WebhookPayload.Message message) {
        WebhookPayload.Value value = new WebhookPayload.Value(
                "whatsapp",
                new WebhookPayload.Metadata("+94112345678", "phone-id"),
                List.of(new WebhookPayload.Contact(WA_ID, new WebhookPayload.Profile("Nimal"))),
                List.of(message),
                null);
        return new WebhookPayload("whatsapp_business_account",
                List.of(new WebhookPayload.Entry("waba-id",
                        List.of(new WebhookPayload.Change("messages", value)))));
    }

    @Test
    void storesAnInboundMessageWithItsContactAndConversation() {
        int stored = service.ingest(textMessage("wamid.AAA", "FBC ekata kiyada?", 1755600000L), "{}");

        assertThat(stored).isEqualTo(1);
        assertThat(contactRepository.findByWaId(WA_ID)).isPresent()
                .get().satisfies(c -> {
                    assertThat(c.getDisplayName()).isEqualTo("Nimal");
                    assertThat(c.isIdentityVerified()).isFalse();
                });

        List<WaMessageEntity> messages = messageRepository.findAll();
        assertThat(messages).singleElement().satisfies(m -> {
            assertThat(m.getDirection()).isEqualTo(MessageDirection.INBOUND);
            assertThat(m.getBody()).isEqualTo("FBC ekata kiyada?");
            assertThat(m.getMetaTimestamp()).isEqualTo(Instant.ofEpochSecond(1755600000L));
        });
    }

    /**
     * The one behaviour the whole ingest path exists to guarantee. Meta redelivers until
     * it sees a 200, so the same message genuinely arrives twice and must not produce
     * two rows — otherwise the agent answers the same question twice and bills for it.
     */
    @Test
    void ignoresARedeliveredMessage() {
        WebhookPayload delivery = textMessage("wamid.BBB", "Report ready da?", 1755600100L);

        assertThat(service.ingest(delivery, "{}")).isEqualTo(1);
        assertThat(service.ingest(delivery, "{}")).isZero();

        assertThat(messageRepository.findAll()).hasSize(1);
    }

    @Test
    void opensTheTwentyFourHourWindowFromTheInboundTimestamp() {
        Instant sentAt = Instant.ofEpochSecond(1755600200L);
        service.ingest(textMessage("wamid.CCC", "Hello", sentAt.getEpochSecond()), "{}");

        assertThat(conversationRepository.findAll()).singleElement().satisfies(c -> {
            assertThat(c.getLastInboundAt()).isEqualTo(sentAt);
            assertThat(c.getWindowExpiresAt()).isEqualTo(sentAt.plus(Duration.ofHours(24)));
            assertThat(c.canSendFreeForm(sentAt.plus(Duration.ofHours(23)))).isTrue();
            assertThat(c.canSendFreeForm(sentAt.plus(Duration.ofHours(25)))).isFalse();
        });
    }

    /** A second message from the same person continues the conversation, not a new one. */
    @Test
    void keepsBothMessagesInOneConversation() {
        service.ingest(textMessage("wamid.DDD", "First", 1755600300L), "{}");
        service.ingest(textMessage("wamid.EEE", "Second", 1755600400L), "{}");

        assertThat(conversationRepository.findAll()).hasSize(1);
        assertThat(messageRepository.findAll()).hasSize(2);
    }

    /** A button tap is an answer. It has to reopen the window like any other message. */
    @Test
    void treatsAnInteractiveReplyAsTheBody() {
        WebhookPayload.Message tap = new WebhookPayload.Message(
                "wamid.FFF", WA_ID, "1755600500", "interactive", null, null,
                new WebhookPayload.Interactive("button_reply",
                        new WebhookPayload.Reply("view_prices", "Test prices"), null));

        assertThat(service.ingest(wrap(tap), "{}")).isEqualTo(1);

        assertThat(messageRepository.findAll()).singleElement()
                .satisfies(m -> assertThat(m.getBody()).isEqualTo("Test prices"));
        assertThat(conversationRepository.findAll()).singleElement()
                .satisfies(c -> assertThat(c.getWindowExpiresAt()).isNotNull());
    }

    /** Status-only deliveries carry no messages and must not create empty rows. */
    @Test
    void ignoresADeliveryWithNoMessages() {
        WebhookPayload.Value statusOnly = new WebhookPayload.Value(
                "whatsapp", new WebhookPayload.Metadata("+94112345678", "phone-id"),
                null, null,
                List.of(new WebhookPayload.Status("wamid.GGG", "delivered", "1755600600", WA_ID, null)));
        WebhookPayload payload = new WebhookPayload("whatsapp_business_account",
                List.of(new WebhookPayload.Entry("waba-id",
                        List.of(new WebhookPayload.Change("messages", statusOnly)))));

        assertThat(service.ingest(payload, "{}")).isZero();
        assertThat(messageRepository.findAll()).isEmpty();
        assertThat(contactRepository.findAll()).isEmpty();
    }
}
