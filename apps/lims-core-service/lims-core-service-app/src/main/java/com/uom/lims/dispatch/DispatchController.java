package com.uom.lims.dispatch;

import com.uom.lims.api.common.PageResponse;
import com.uom.lims.api.dispatch.DispatchApi;
import com.uom.lims.api.dispatch.dto.request.DispatchReportRequest;
import com.uom.lims.api.dispatch.dto.request.RegisterAuthorizedReportRequest;
import com.uom.lims.api.dispatch.dto.response.DeliveryRecordResponse;
import com.uom.lims.api.dispatch.dto.response.DispatchDashboardItemResponse;
import com.uom.lims.api.dispatch.dto.response.DispatchItemResponse;
import com.uom.lims.api.dispatch.dto.response.FailedDeliveryResponse;
import com.uom.lims.api.dispatch.enums.DispatchItemStatus;
import com.uom.lims.security.ClientIpResolver;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class DispatchController implements DispatchApi {

    private final DispatchService dispatchService;

    private static String currentClientIp() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes servletAttrs)) {
            return "unknown";
        }
        return ClientIpResolver.resolve(servletAttrs.getRequest());
    }

    /**
     * Machine-to-machine ingress. The normal path into dispatch is the
     * clinical-authorization event, which reaches
     * {@code DispatchService.registerAuthorizedReportSystem} via
     * {@code ClinicalReportAuthorizedDispatchListener} — no HTTP call involved.
     *
     * <p>MLT and BRANCH_ADMIN previously held this. Because the underlying
     * operation upserts on (reportReference, branchCode), that let a technologist
     * overwrite the patient name and artifact URI of an already-delivered report,
     * and the dispatch email renders artifactUri as a "Download report" link sent
     * from the hospital's own address. It also never checked that the referenced
     * result was authorized at all, so a report could be pushed into dispatch
     * without a pathologist ever signing it. Restricted to SUPER_ADMIN until a
     * dedicated service-account role exists in the realm.
     */
    @Override
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public DispatchItemResponse registerAuthorizedReport(@Valid RegisterAuthorizedReportRequest request) {
        return dispatchService.registerAuthorizedReport(request, currentClientIp());
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','FRONT_DESK','SUPER_ADMIN','BRANCH_ADMIN','LAB_SUPERVISOR','MLT','PATHOLOGIST','PATIENT')")
    public PageResponse<DispatchDashboardItemResponse> listDispatchReports(
            DispatchItemStatus status,
            String branchCode,
            String keyword,
            int page,
            int size,
            String sort) {
        
        String effectiveKeyword = keyword;
        if (com.uom.lims.security.SecurityUtils.hasRole("PATIENT")) {
            org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof org.springframework.security.oauth2.jwt.Jwt jwt) {
                effectiveKeyword = jwt.getClaimAsString("preferred_username");
            }
        }
                
        return dispatchService.listDispatchReports(status, branchCode, effectiveKeyword, page, size, sort);
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','FRONT_DESK','SUPER_ADMIN','BRANCH_ADMIN','LAB_SUPERVISOR','MLT','PATHOLOGIST','PATIENT')")
    public DispatchItemResponse getDispatchReport(String reportReference, String branchCode) {
        DispatchItemResponse response = dispatchService.getDispatchReport(reportReference, branchCode);
        if (com.uom.lims.security.SecurityUtils.hasRole("PATIENT")) {
            org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof org.springframework.security.oauth2.jwt.Jwt jwt) {
                String patientCode = jwt.getClaimAsString("preferred_username");
                if (patientCode != null && !patientCode.equals(response.getPatientId())) {
                    throw new org.springframework.security.access.AccessDeniedException("Access Denied");
                }
            }
        }
        return response;
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','FRONT_DESK','SUPER_ADMIN','BRANCH_ADMIN','LAB_SUPERVISOR','MLT','PATHOLOGIST')")
    public PageResponse<DeliveryRecordResponse> listDeliveryRecords(
            DispatchItemStatus status,
            String branchCode,
            String keyword,
            int page,
            int size,
            String sort) {
        return dispatchService.listDeliveryRecords(status, branchCode, keyword, page, size, sort);
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','SUPER_ADMIN','BRANCH_ADMIN','LAB_SUPERVISOR','MLT','PATHOLOGIST')")
    public List<FailedDeliveryResponse> listFailedDeliveries(String branchCode, int limit) {
        return dispatchService.listFailedDeliveries(branchCode, limit);
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','SUPER_ADMIN')")
    public DispatchItemResponse dispatchReport(String reportReference, String branchCode, @Valid DispatchReportRequest request) {
        return dispatchService.dispatchReport(reportReference, branchCode, request, currentClientIp());
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','SUPER_ADMIN')")
    public DispatchItemResponse retryAttempt(UUID attemptId) {
        return dispatchService.retryAttempt(attemptId, currentClientIp());
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','SUPER_ADMIN')")
    public DispatchItemResponse markAttemptDelivered(UUID attemptId) {
        return dispatchService.markAttemptDelivered(attemptId, currentClientIp());
    }
}
