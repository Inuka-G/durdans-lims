package com.uom.lims.whatsapp.reply;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.whatsapp.agent.AgentProperties;
import com.uom.lims.whatsapp.agent.CoreCatalogClient;
import com.uom.lims.whatsapp.outbound.MetaSendClient;
import com.uom.lims.whatsapp.outbound.OutboundMessageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MenuRouterTest {

    private static final AgentProperties CORE_ON = new AgentProperties(
            true, "", null, null, null, null, null, "client-secret", 0, 0);

    private static final AgentProperties CORE_OFF = new AgentProperties(
            true, "", null, null, null, null, null, "", 0, 0);

    @Mock
    private CoreCatalogClient catalog;

    @Mock
    private OutboundMessageService outbound;

    private MenuRouter router(AgentProperties properties) {
        return new MenuRouter(properties, catalog, outbound, new ObjectMapper());
    }

    private static InboundMessageStoredEvent tap(String interactiveId, String title) {
        return new InboundMessageStoredEvent(UUID.randomUUID(), UUID.randomUUID(),
                "94770000002", title, "interactive", interactiveId);
    }

    @Test
    void typedTextIsNeverRouted() {
        InboundMessageStoredEvent typed = new InboundMessageStoredEvent(UUID.randomUUID(), UUID.randomUUID(),
                "94770000002", "cbc price?", "text", null);

        assertThat(router(CORE_ON).route(typed)).isFalse();
        verifyNoInteractions(catalog, outbound);
    }

    @Test
    void pricesTapBuildsATestListWithPricesInDescriptions() {
        when(catalog.searchTests("", "si")).thenReturn("""
                [{"testCode":"FBC","testName":"සම්පූර්ණ රුධිර ගණනය","englishName":"Full Blood Count","price":1200.00},
                 {"testCode":"HBA1C","testName":"HbA1c","englishName":"HbA1c","price":2750.00}]""");

        assertThat(router(CORE_ON).route(tap("menu_prices", "Test prices"))).isTrue();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<MetaSendClient.MenuRow>> rows = ArgumentCaptor.forClass(List.class);
        verify(outbound).sendMenu(any(), anyString(), eq("Tests"), rows.capture());
        assertThat(rows.getValue()).hasSize(3);
        assertThat(rows.getValue().get(0).id()).isEqualTo("test_FBC");
        assertThat(rows.getValue().get(0).title()).isEqualTo("Full Blood Count");
        assertThat(rows.getValue().get(0).description()).contains("Rs. 1,200").contains("සම්පූර්ණ");
        assertThat(rows.getValue().get(2).id()).isEqualTo("menu_other");
    }

    @Test
    void testTapAnswersDeterministicallyFromTheCatalogue() {
        when(catalog.searchTests("FBC", "si")).thenReturn("""
                [{"testCode":"FBC","testName":"සම්පූර්ණ රුධිර ගණනය","englishName":"Full Blood Count",
                  "price":1200.00,"turnAroundTimeHours":24,"fastingRequired":false}]""");

        assertThat(router(CORE_ON).route(tap("test_FBC", "Full Blood Count"))).isTrue();
        verify(outbound).sendFreeFormText(any(), contains("Rs. 1,200"));
    }

    @Test
    void packageTapShowsSavingAndContents() {
        when(catalog.getPackage("FULL", "si")).thenReturn("""
                {"packageCode":"FULL","packageName":"Full Body","englishName":"Full Body Checkup",
                 "price":9900.00,"individualTotal":12400.00,"saving":2500.00,
                 "fastingRequired":true,"fastingHours":12,
                 "items":[{"testCode":"FBC","englishName":"Full Blood Count"}]}""");

        assertThat(router(CORE_ON).route(tap("package_FULL", "Full Body Checkup"))).isTrue();
        verify(outbound).sendFreeFormText(any(), contains("save"));
    }

    @Test
    void unknownTestCodeFallsThroughToTheAgent() {
        when(catalog.searchTests("XYZ", "si")).thenReturn("[]");

        assertThat(router(CORE_ON).route(tap("test_XYZ", "Mystery"))).isFalse();
        verifyNoInteractions(outbound);
    }

    @Test
    void staticPromptsNeedNoCatalogue() {
        assertThat(router(CORE_OFF).route(tap("menu_report", "Report status"))).isTrue();
        verify(outbound).sendFreeFormText(any(), eq(MenuRouter.REPORT_PROMPT));
        verifyNoInteractions(catalog);
    }

    @Test
    void catalogueTapsFallThroughWhenTheCoreIsNotConfigured() {
        assertThat(router(CORE_OFF).route(tap("menu_prices", "Test prices"))).isFalse();
        verifyNoInteractions(catalog, outbound);
    }

    @Test
    void aFailedLookupFallsThroughInsteadOfCrashing() {
        when(catalog.searchTests("", "si")).thenReturn("{\"error\":\"catalogue lookup failed\"}");

        assertThat(router(CORE_ON).route(tap("menu_prices", "Test prices"))).isFalse();
        verify(outbound, org.mockito.Mockito.never()).sendMenu(any(), anyString(), anyString(), anyList());
    }

    @Test
    void longNamesAreClippedToMetaRowLimits() {
        when(catalog.searchTests("", "si")).thenReturn("""
                [{"testCode":"LONG","englishName":"An Extremely Long Laboratory Test Name That Overflows",
                  "testName":"x","price":500}]""");

        router(CORE_ON).route(tap("menu_prices", "Test prices"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<MetaSendClient.MenuRow>> rows = ArgumentCaptor.forClass(List.class);
        verify(outbound).sendMenu(any(), anyString(), anyString(), rows.capture());
        assertThat(rows.getValue().get(0).title().length()).isLessThanOrEqualTo(24);
    }
}
