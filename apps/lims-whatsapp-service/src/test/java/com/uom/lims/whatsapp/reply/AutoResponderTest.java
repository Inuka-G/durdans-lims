package com.uom.lims.whatsapp.reply;

import com.uom.lims.whatsapp.agent.AgentOrchestrator;
import com.uom.lims.whatsapp.agent.AgentProperties;
import com.uom.lims.whatsapp.config.MetaProperties;
import com.uom.lims.whatsapp.outbound.OutboundMessageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoResponderTest {

    private static final MetaProperties SEND_CONFIGURED = new MetaProperties(
            "app-id", "app-secret", "verify", "12345", "waba", "token", null, null);

    private static final MetaProperties SEND_UNCONFIGURED = new MetaProperties(
            "app-id", "app-secret", "verify", "12345", "waba", "", null, null);

    private static final AgentProperties AGENT_ON = new AgentProperties(
            true, "gemini-key", null, null, null, null, null, "client-secret", 0, 0);

    private static final AgentProperties AGENT_OFF = new AgentProperties(
            true, "", null, null, null, null, null, "", 0, 0);

    @Mock
    private AgentOrchestrator agent;

    @Mock
    private MenuRouter menuRouter;

    @Mock
    private OutboundMessageService outbound;

    private static InboundMessageStoredEvent event(UUID conversationId, String body) {
        return new InboundMessageStoredEvent(
                UUID.randomUUID(), conversationId, "94770000002", body, "text", null);
    }

    private static InboundMessageStoredEvent tap(UUID conversationId, String interactiveId, String title) {
        return new InboundMessageStoredEvent(
                UUID.randomUUID(), conversationId, "94770000002", title, "interactive", interactiveId);
    }

    private AutoResponder responder(AutoReplyProperties greeting, MetaProperties meta, AgentProperties agentProps) {
        return new AutoResponder(greeting, meta, agentProps, agent, menuRouter, outbound);
    }

    private static AutoReplyProperties greetingEnabled() {
        return new AutoReplyProperties(true, Duration.ofMinutes(30), "custom greeting");
    }

    @Test
    void failsClosedWhenSendCredentialsAreMissing() {
        responder(greetingEnabled(), SEND_UNCONFIGURED, AGENT_ON)
                .onInboundStored(event(UUID.randomUUID(), "hello"));

        verifyNoInteractions(outbound, agent);
    }

    @Test
    void agentAnswersTextMessagesWhenConfigured() {
        UUID conversationId = UUID.randomUUID();
        when(agent.reply(conversationId, "94770000002")).thenReturn(Optional.of("FBC is Rs. 1,200"));
        when(outbound.sendFreeFormText(conversationId, "FBC is Rs. 1,200")).thenReturn(Optional.empty());

        responder(greetingEnabled(), SEND_CONFIGURED, AGENT_ON)
                .onInboundStored(event(conversationId, "cbc price?"));

        verify(outbound).sendFreeFormText(conversationId, "FBC is Rs. 1,200");
        verify(outbound, never()).sendAutoReplyIfDue(any(), any(), any());
    }

    @Test
    void agentSilenceFallsBackToTheCooldownLimitedApology() {
        UUID conversationId = UUID.randomUUID();
        when(agent.reply(conversationId, "94770000002")).thenReturn(Optional.empty());

        responder(greetingEnabled(), SEND_CONFIGURED, AGENT_ON)
                .onInboundStored(event(conversationId, "cbc price?"));

        verify(outbound).sendAutoReplyIfDue(conversationId, AutoResponder.AGENT_FALLBACK, Duration.ofMinutes(5));
        verify(outbound, never()).sendFreeFormText(any(), any());
    }

    @Test
    void agentFailureFallsBackInsteadOfPropagating() {
        UUID conversationId = UUID.randomUUID();
        when(agent.reply(conversationId, "94770000002")).thenThrow(new IllegalStateException("Gemini returned 429"));

        responder(greetingEnabled(), SEND_CONFIGURED, AGENT_ON)
                .onInboundStored(event(conversationId, "cbc price?"));

        verify(outbound).sendAutoReplyIfDue(conversationId, AutoResponder.AGENT_FALLBACK, Duration.ofMinutes(5));
    }

    @Test
    void bareGreetingGetsTheMenuWithoutAModelCall() {
        UUID conversationId = UUID.randomUUID();

        responder(greetingEnabled(), SEND_CONFIGURED, AGENT_ON)
                .onInboundStored(event(conversationId, "Hi"));

        verifyNoInteractions(agent);
        verify(outbound).sendMenuIfDue(conversationId, AutoResponder.MENU_BODY, AutoResponder.MENU_BUTTON,
                AutoResponder.MENU_ROWS, Duration.ofSeconds(60));
        verify(outbound, never()).sendFreeFormText(any(), any());
    }

    @Test
    void aRoutedTapEndsThereWithoutTheAgent() {
        UUID conversationId = UUID.randomUUID();
        InboundMessageStoredEvent tapped = tap(conversationId, "menu_report", "Report status");
        when(menuRouter.route(tapped)).thenReturn(true);

        responder(greetingEnabled(), SEND_CONFIGURED, AGENT_ON).onInboundStored(tapped);

        verifyNoInteractions(agent);
        verify(outbound, never()).sendFreeFormText(any(), any());
    }

    @Test
    void anUnroutedTapFallsThroughToTheAgent() {
        UUID conversationId = UUID.randomUUID();
        InboundMessageStoredEvent tapped = tap(conversationId, "test_UNKNOWN", "Mystery test");
        when(menuRouter.route(tapped)).thenReturn(false);
        when(agent.reply(conversationId, "94770000002")).thenReturn(Optional.of("Could not find that one."));
        when(outbound.sendFreeFormText(any(), any())).thenReturn(Optional.empty());

        responder(greetingEnabled(), SEND_CONFIGURED, AGENT_ON).onInboundStored(tapped);

        verify(agent).reply(conversationId, "94770000002");
    }

    @Test
    void nonTextMessagesGetTheGreetingEvenWithTheAgentOn() {
        UUID conversationId = UUID.randomUUID();

        responder(greetingEnabled(), SEND_CONFIGURED, AGENT_ON)
                .onInboundStored(event(conversationId, null));

        verifyNoInteractions(agent);
        verify(outbound).sendAutoReplyIfDue(conversationId, "custom greeting", Duration.ofMinutes(30));
    }

    @Test
    void greetingTierAnswersRealQuestionsWhenTheAgentIsNotConfigured() {
        // "cbc price?" is not a bare greeting, so it skips the menu tier; with no
        // agent configured it lands on the greeting tier.
        UUID conversationId = UUID.randomUUID();

        responder(greetingEnabled(), SEND_CONFIGURED, AGENT_OFF)
                .onInboundStored(event(conversationId, "cbc price?"));

        verifyNoInteractions(agent);
        verify(outbound).sendAutoReplyIfDue(conversationId, "custom greeting", Duration.ofMinutes(30));
    }

    @Test
    void disabledGreetingTierStaysSilentForRealQuestions() {
        AutoReplyProperties disabled = new AutoReplyProperties(false, Duration.ofHours(1), null);

        responder(disabled, SEND_CONFIGURED, AGENT_OFF)
                .onInboundStored(event(UUID.randomUUID(), "cbc price?"));

        verifyNoInteractions(outbound, agent);
    }

    @Test
    void menuStillAnswersGreetingsWhenEverythingElseIsOff() {
        // The menu is deliberately outside the greeting tier's kill switch: it is
        // navigation, not chatter, and it needs nothing but send credentials.
        AutoReplyProperties disabled = new AutoReplyProperties(false, Duration.ofHours(1), null);
        UUID conversationId = UUID.randomUUID();

        responder(disabled, SEND_CONFIGURED, AGENT_OFF)
                .onInboundStored(event(conversationId, "hello"));

        verifyNoInteractions(agent);
        verify(outbound).sendMenuIfDue(conversationId, AutoResponder.MENU_BODY, AutoResponder.MENU_BUTTON,
                AutoResponder.MENU_ROWS, Duration.ofSeconds(60));
    }
}
