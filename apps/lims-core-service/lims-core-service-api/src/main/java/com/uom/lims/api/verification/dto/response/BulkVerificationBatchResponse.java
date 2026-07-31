package com.uom.lims.api.verification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkVerificationBatchResponse {
    private String batchId;
    private String batchName;
    private String batchCode;
    private String department;
    private int totalResults;
    private int safeForApproval;
    private int exceptions;
    private Instant updatedAt;
    private List<String> resultIds;
    private List<String> reviewResultIds;
}
