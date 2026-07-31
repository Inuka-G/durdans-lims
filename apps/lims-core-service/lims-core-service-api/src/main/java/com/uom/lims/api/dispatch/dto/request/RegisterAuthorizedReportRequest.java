package com.uom.lims.api.dispatch.dto.request;

import com.uom.lims.api.dispatch.enums.DeliveryMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Idempotent registration of an authorized lab report into the dispatch queue (REST or Kafka ingress).")
public class RegisterAuthorizedReportRequest {

    @NotBlank
    @Size(max = 100)
    @Schema(description = "Stable report identifier from the lab module", example = "REP-2023-9901", requiredMode = Schema.RequiredMode.REQUIRED)
    private String reportReference;

    @NotBlank
    @Size(max = 100)
    @Schema(description = "Branch where the report was authorized", example = "BR001", requiredMode = Schema.RequiredMode.REQUIRED)
    private String branchCode;

    @Size(max = 50)
    @Schema(description = "Patient master code when known; used to resolve email/SMS for delivery")
    private String patientCode;

    @NotBlank
    @Size(max = 255)
    @Schema(description = "Display name for dispatch UI", requiredMode = Schema.RequiredMode.REQUIRED)
    private String patientDisplayName;

    @NotBlank
    @Size(max = 500)
    @Schema(description = "Test or panel label shown to dispatch staff", requiredMode = Schema.RequiredMode.REQUIRED)
    private String testPanelLabel;

    @Size(max = 2048)
    @Schema(description = "Optional URI to final report artifact (PDF, portal object, etc.)")
    private String artifactUri;

    @Schema(description = "Authorization timestamp from lab; defaults to server time if omitted")
    private OffsetDateTime authorizedAt;

    @Schema(description = "Suggested delivery channels from the lab workflow")
    private List<DeliveryMethod> preferredDeliveryMethods;
}
