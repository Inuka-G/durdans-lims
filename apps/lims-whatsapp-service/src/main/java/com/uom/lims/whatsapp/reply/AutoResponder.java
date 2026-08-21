package com.uom.lims.whatsapp.reply;

import com.uom.lims.whatsapp.agent.AgentOrchestrator;
import com.uom.lims.whatsapp.agent.AgentProperties;
import com.uom.lims.whatsapp.config.AsyncConfig;
import com.uom.lims.whatsapp.config.MetaProperties;
import com.uom.lims.whatsapp.outbound.MetaSendClient;
import com.uom.lims.whatsapp.outbound.OutboundMessageService;
import com.uom.lims.whatsapp.util.PiiMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Decides what a stored inbound message gets back, off the request thread, after commit.
 *
 * <p>Four tiers, each failing closed into the next:
 * <ol>
 *   <li>The welcome menu — for bare greetings, deterministically, without a model call.
 *       A patient who says "hi" wants to know what this thing does; a menu answers that
 *       faster and cheaper than Gemini ever could.</li>
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

    /** "hi hi hi" gets one menu, not three; anything longer than this gap gets a fresh one. */
    private static final Duration MENU_COOLDOWN = Duration.ofSeconds(60);

    static final String MENU_BODY = """
            ආයුබෝවන්! Durdans Laboratory 🙏
            මොනවද ඕනෑ කියලා menu එකෙන් තෝරන්න — නැත්නම් ප්‍රශ්නය කෙලින්ම type කරන්න.

            Welcome! Pick from the menu, or just type your question.""";

    static final String MENU_BUTTON = "Menu";

    /** Row titles double as the agent's input when tapped, so they must read as intents. */
    static final List<MetaSendClient.MenuRow> MENU_ROWS = List.of(
            new MetaSendClient.MenuRow("menu_prices", "Test prices", "පරීක්ෂණ මිල ගණන්"),
            new MetaSendClient.MenuRow("menu_packages", "Health packages", "පැකේජ සහ ඉතිරිකිරීම්"),
            new MetaSendClient.MenuRow("menu_report", "Report status", "රිපෝට් එක ready ද බලන්න"),
            new MetaSendClient.MenuRow("menu_prep", "Test preparation", "නිරාහාරව ඒම / සූදානම"),
            new MetaSendClient.MenuRow("menu_contact", "Contact us", "දුරකථන සහ ලිපිනය"));

    private final AutoReplyProperties properties;
    private final MetaProperties meta;
    private final AgentProperties agentProperties;
    private final AgentOrchestrator agent;
    private final MenuRouter menuRouter;
    private final OutboundMessageService outbound;

    @Async(AsyncConfig.REPLY_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onInboundStored(InboundMessageStoredEvent event) {
        if (!meta.isSendConfigured()) {
            // The webhook can be live before send credentials are. Fail closed, quietly.
            log.debug("Send credentials not configured; skipping reply");
            return;
        }
        if (Greetings.isBareGreeting(event.body())) {
            sendMenu(event);
            return;
        }
        // Taps carry a machine id and get deterministic answers; anything the router
        // does not claim — typed text, unknown ids, empty lookups — reaches the agent.
        if (menuRouter.route(event)) {
            return;
        }
        if (agentProperties.isConfigured() && event.body() != null && !event.body().isBlank()) {
            answerWithAgent(event);
            return;
        }
        greet(event);
    }

    private void sendMenu(InboundMessageStoredEvent event) {
        try {
            outbound.sendMenuIfDue(event.conversationId(), MENU_BODY, MENU_BUTTON, MENU_ROWS, MENU_COOLDOWN)
                    .ifPresent(m -> log.info("Sent welcome menu to {}", PiiMasker.maskWaId(event.waId())));
        } catch (Exception e) {
            log.error("Welcome menu to {} failed", PiiMasker.maskWaId(event.waId()), e);
        }
    }

    private void answerWithAgent(InboundMessageStoredEvent event) {
        try {
            Optional<String> answer = agent.reply(event.conversationId(), event.waId(), event.displayName());
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
