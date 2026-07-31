package com.uom.lims.api.dispatch;

import com.uom.lims.api.common.PageResponse;
import com.uom.lims.api.dispatch.dto.request.DispatchReportRequest;
import com.uom.lims.api.dispatch.dto.request.RegisterAuthorizedReportRequest;
import com.uom.lims.api.dispatch.dto.response.DeliveryRecordResponse;
import com.uom.lims.api.dispatch.dto.response.DispatchDashboardItemResponse;
import com.uom.lims.api.dispatch.dto.response.DispatchItemResponse;
import com.uom.lims.api.dispatch.dto.response.FailedDeliveryResponse;
import com.uom.lims.api.dispatch.enums.DispatchItemStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.List;
import java.util.UUID;

@RequestMapping("/api/v1/dispatch")
@Tag(name = "Report dispatch", description = "Authorized report delivery queue and channel execution")
public interface DispatchApi {

    @Operation(summary = "Register authorized report", description = "Idempotent ingress from lab module (REST). Same payload as Kafka topic lab.report.authorized.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Created or updated",
                    content = @Content(schema = @Schema(implementation = DispatchItemResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid payload")
    })
    @PostMapping("/reports/register")
    @ResponseStatus(HttpStatus.OK)
    DispatchItemResponse registerAuthorizedReport(
            @Valid @RequestBody RegisterAuthorizedReportRequest request);

    @Operation(summary = "List dispatch queue (dashboard)")
    @GetMapping("/reports")
    @ResponseStatus(HttpStatus.OK)
    PageResponse<DispatchDashboardItemResponse> listDispatchReports(
            @Parameter(description = "Filter by overall status") @RequestParam(name = "status", required = false) DispatchItemStatus status,
            @Parameter(description = "Branch filter; super admin may pass explicit branch") @RequestParam(name = "branchCode", required = false) String branchCode,
            @Parameter(description = "Search report id, patient name, or test") @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sort", defaultValue = "authorizedAt,desc") String sort);

    @Operation(summary = "Get dispatch item with attempts")
    @GetMapping("/reports/{reportReference}")
    @ResponseStatus(HttpStatus.OK)
    DispatchItemResponse getDispatchReport(
            @Parameter(description = "Report business reference", required = true) @PathVariable("reportReference") String reportReference,
            @RequestParam(name = "branchCode", required = false) String branchCode);

    @Operation(summary = "Delivery status rows", description = "Reports that have at least one delivery attempt")
    @GetMapping("/delivery-records")
    @ResponseStatus(HttpStatus.OK)
    PageResponse<DeliveryRecordResponse> listDeliveryRecords(
            @RequestParam(name = "status", required = false) DispatchItemStatus status,
            @RequestParam(name = "branchCode", required = false) String branchCode,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sort", defaultValue = "authorizedAt,desc") String sort);

    @Operation(summary = "Failed delivery attempts")
    @GetMapping("/failed-deliveries")
    @ResponseStatus(HttpStatus.OK)
    List<FailedDeliveryResponse> listFailedDeliveries(
            @RequestParam(name = "branchCode", required = false) String branchCode,
            @RequestParam(name = "limit", defaultValue = "50") int limit);

    @Operation(summary = "Execute dispatch for channels")
    @PostMapping("/reports/{reportReference}/dispatch")
    @ResponseStatus(HttpStatus.OK)
    DispatchItemResponse dispatchReport(
            @PathVariable("reportReference") String reportReference,
            @RequestParam(name = "branchCode", required = false) String branchCode,
            @Valid @RequestBody DispatchReportRequest request);

    @Operation(summary = "Retry a failed delivery attempt")
    @PostMapping("/attempts/{attemptId}/retry")
    @ResponseStatus(HttpStatus.OK)
    DispatchItemResponse retryAttempt(@PathVariable("attemptId") UUID attemptId);

    @Operation(summary = "Mark a sent delivery attempt as delivered")
    @PostMapping("/attempts/{attemptId}/mark-delivered")
    @ResponseStatus(HttpStatus.OK)
    DispatchItemResponse markAttemptDelivered(@PathVariable("attemptId") UUID attemptId);
}
