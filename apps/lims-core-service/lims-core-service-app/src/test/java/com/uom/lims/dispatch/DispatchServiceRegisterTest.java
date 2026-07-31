package com.uom.lims.dispatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.dispatch.dto.request.RegisterAuthorizedReportRequest;
import com.uom.lims.api.dispatch.enums.DispatchItemStatus;
import com.uom.lims.audit.AuditService;
import com.uom.lims.exception.InvalidRequestException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DispatchServiceRegisterTest {

    @Mock
    private ReportDispatchItemRepository itemRepository;

    @Mock
    private ReportDeliveryAttemptRepository attemptRepository;

    @Mock
    private ReportDispatchChannelService channelService;

    @Mock
    private AuditService auditService;

    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private DispatchService dispatchService;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void register_rejectsNonSuperAdmin_whenBranchMissingFromToken() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "mlt", "n/a", List.of(new SimpleGrantedAuthority("ROLE_MLT"))));

        RegisterAuthorizedReportRequest req = RegisterAuthorizedReportRequest.builder()
                .reportReference("REP-Y")
                .branchCode("BR001")
                .patientDisplayName("X")
                .testPanelLabel("Y")
                .build();

        assertThrows(InvalidRequestException.class,
                () -> dispatchService.registerAuthorizedReport(req, "192.168.1.10"));
    }

    @Test
    void register_updatesExistingRow_whenSameReferenceAndBranch() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin", "n/a", java.util.List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));

        ReportDispatchItemEntity existing = new ReportDispatchItemEntity();
        existing.setId(UUID.randomUUID());
        existing.setReportReference("REP-X");
        existing.setBranchCode("BR001");
        existing.setPatientDisplayName("Old");
        existing.setTestPanelLabel("OldTest");
        existing.setAuthorizedAt(LocalDateTime.now().minusDays(1));
        existing.setOverallStatus(DispatchItemStatus.DELIVERED);

        when(itemRepository.findByReportReferenceAndBranchCode("REP-X", "BR001"))
                .thenReturn(Optional.of(existing));
        when(objectMapper.writeValueAsString(any())).thenReturn("[]");
        when(itemRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RegisterAuthorizedReportRequest req = RegisterAuthorizedReportRequest.builder()
                .reportReference("REP-X")
                .branchCode("BR001")
                .patientDisplayName("New Name")
                .testPanelLabel("New Panel")
                .build();

        dispatchService.registerAuthorizedReport(req, "127.0.0.1");

        ArgumentCaptor<ReportDispatchItemEntity> captor = ArgumentCaptor.forClass(ReportDispatchItemEntity.class);
        verify(itemRepository, times(1)).save(captor.capture());
        assertEquals("New Name", captor.getValue().getPatientDisplayName());
        assertEquals("New Panel", captor.getValue().getTestPanelLabel());
        assertEquals(DispatchItemStatus.DELIVERED, captor.getValue().getOverallStatus());
    }
}
