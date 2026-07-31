package com.uom.lims.api.phlebotomy;

import com.uom.lims.api.dto.request.SampleCollectRequest;
import com.uom.lims.api.dto.request.SampleRejectRequest;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.CollectionHistoryResponse;
import com.uom.lims.api.dto.response.PhlebotomyStatsResponse;
import com.uom.lims.api.dto.response.SampleResponse;
import com.uom.lims.api.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * WHY: Governs the specimen collection phase, tracking sample integrity from collection
 * to the lab, and providing history for phlebotomy performance monitoring.
 */
@RequestMapping("/api/v1/phlebotomy")
@Tag(name = "Phlebotomy Workflow", description = "Operations related to clinical specimen collection and rejection")
public interface PhlebotomyApi {

    @Operation(summary = "Get phlebotomy dashboard statistics", description = "Retrieves real-time counts for the phlebotomy queue")
    @GetMapping("/statistics")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<PhlebotomyStatsResponse>> getPhlebotomyStats();

    @Operation(summary = "Get pending collections worklist", description = "Retrieves a list of samples awaiting phlebotomy")
    @GetMapping("/worklist")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<PageResponse<SampleResponse>>> getPendingSamples(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size);

    @Operation(summary = "Record sample collection", description = "Marks a specimen as collected and records phlebotomist details")
    @PostMapping("/samples/{sampleId}/collect")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<SampleResponse>> collectSample(@PathVariable("sampleId") UUID sampleId, @Valid @RequestBody SampleCollectRequest request);

    @Operation(summary = "Reject a sample", description = "Marks a sample as rejected and triggers an automatic recollection request")
    @PostMapping("/samples/{sampleId}/reject")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<SampleResponse>> rejectSample(@PathVariable("sampleId") UUID sampleId, @Valid @RequestBody SampleRejectRequest request);

    @Operation(summary = "Get collection history", description = "Retrieves a history of all collected and rejected specimens")
    @GetMapping("/collection-history")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<PageResponse<CollectionHistoryResponse>>> getCollectionHistory(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size);

    @Operation(summary = "Get sample detail", description = "Returns specimen metadata for phlebotomy drill-down (history detail)")
    @GetMapping("/samples/{sampleId}")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<SampleResponse>> getSampleDetail(@PathVariable("sampleId") UUID sampleId);

    @Operation(summary = "Record specimen label print", description = "Increments persisted barcode label print count after user confirms print/reprint")
    @PostMapping("/samples/{sampleId}/print-label")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<SampleResponse>> recordLabelPrint(@PathVariable("sampleId") UUID sampleId);
}
