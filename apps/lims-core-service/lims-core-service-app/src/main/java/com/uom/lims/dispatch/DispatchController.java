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

    @Override
    @PreAuthorize("hasAnyRole('MLT','SUPER_ADMIN','BRANCH_ADMIN')")
    public DispatchItemResponse registerAuthorizedReport(@Valid RegisterAuthorizedReportRequest request) {
        return dispatchService.registerAuthorizedReport(request, currentClientIp());
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','FRONT_DESK','SUPER_ADMIN','BRANCH_ADMIN','LAB_SUPERVISOR','MLT','PATHOLOGIST')")
    public PageResponse<DispatchDashboardItemResponse> listDispatchReports(
            DispatchItemStatus status,
            String branchCode,
            String keyword,
            int page,
            int size,
            String sort) {
        return dispatchService.listDispatchReports(status, branchCode, keyword, page, size, sort);
    }

    @Override
    @PreAuthorize("hasAnyRole('DISPATCH_OFFICER','DISPATCH','FRONT_DESK','SUPER_ADMIN','BRANCH_ADMIN','LAB_SUPERVISOR','MLT','PATHOLOGIST')")
    public DispatchItemResponse getDispatchReport(String reportReference, String branchCode) {
        return dispatchService.getDispatchReport(reportReference, branchCode);
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
