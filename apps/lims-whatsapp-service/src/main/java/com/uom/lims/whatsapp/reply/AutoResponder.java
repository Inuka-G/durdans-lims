package com.uom.lims.whatsapp.reply;

import com.uom.lims.whatsapp.agent.AgentOrchestrator;
import com.uom.lims.whatsapp.agent.AgentProperties;
import com.uom.lims.whatsapp.config.AsyncConfig;
import com.uom.lims.whatsapp.config.MetaProperties;
import com.uom.lims.whatsapp.outbound.OutboundMessageService;
import com.uom.lims.whatsapp.util.PiiMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.util.Optional;

/**
 * Decides what a stored inbound message gets back, off the request thread, after commit.
 *
 * <p>Three tiers, each failing closed into the next:
 * <ol>
 *   <li>The agent — when it is configured and the message has text.</li>
 *   <li>A short bilingual "could not process" line when the agent was supposed to answer
 *       and could not, cooldown-limited so an outage does not spam a patient.</li>
 *   <li>The static greeting, cooldown-limited, when the agent is not in play at all.</li>
 * </ol>
 * A failure here is logged and abandoned; the inbound message is already durable, and
 * the patient's next message is the retry.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoResponder {

    /** Sent when the agent should have answered and could not. Cooldown keeps an outage polite. */
    static final String AGENT_FALLBACK = """
            සමාවෙන්න, මේ මොහොතේ පිළිතුරක් දීමට නොහැකි වුණා. කරුණාකර ටික වේලාවකින් නැවත උත්සාහ කරන්න.

            Sorry — I could not process that just now. Please try again shortly.""";

    private static final Duration FALLBACK_COOLDOWN = Duration.ofMinutes(5);

    private final AutoReplyProperties properties;
    private final MetaProperties meta;
    private final AgentProperties agentProperties;
    private final AgentOrchestrator agent;
    private final OutboundMessageService outbound;

    @Async(AsyncConfig.REPLY_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onInboundStored(InboundMessageStoredEvent event) {
        if (!meta.isSendConfigured()) {
            // The webhook can be live before send credentials are. Fail closed, quietly.
            log.debug("Send credentials not configured; skipping reply");
            return;
        }
        if (agentProperties.isConfigured() && event.body() != null && !event.body().isBlank()) {
            answerWithAgent(event);
            return;
        }
        greet(event);
    }

    private void answerWithAgent(InboundMessageStoredEvent event) {
        try {
            Optional<String> answer = agent.reply(event.conversationId());
            if (answer.isPresent()) {
                outbound.sendFreeFormText(event.conversationId(), answer.get())
                        .ifPresent(m -> log.info("Agent answered {}", PiiMasker.maskWaId(event.waId())));
                return;
            }
            log.warn("Agent produced no answer for {}", PiiMasker.maskWaId(event.waId()));
        } catch (Exception e) {
            log.error("Agent failed for {}", PiiMasker.maskWaId(event.waId()), e);
        }
        try {
            outbound.sendAutoReplyIfDue(event.conversationId(), AGENT_FALLBACK, FALLBACK_COOLDOWN);
        } catch (Exception e) {
            log.error("Fallback reply to {} failed", PiiMasker.maskWaId(event.waId()), e);
        }
    }

    private void greet(InboundMessageStoredEvent event) {
        if (!properties.enabled()) {
            return;
        }
        try {
            outbound.sendAutoReplyIfDue(event.conversationId(), properties.greeting(), properties.cooldown())
                    .ifPresent(m -> log.info("Auto-acknowledged inbound message from {}",
                            PiiMasker.maskWaId(event.waId())));
        } catch (Exception e) {
            log.error("Auto-reply to {} failed", PiiMasker.maskWaId(event.waId()), e);
        }
    }
}
