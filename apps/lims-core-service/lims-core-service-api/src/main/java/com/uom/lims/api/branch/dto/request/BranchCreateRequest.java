package com.uom.lims.api.branch.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BranchCreateRequest {

    @Schema(description = "Branch Code", example = "Colombo")
    @NotBlank(message = "Branch Code is required")
    private String code;

    @Schema(description = "Branch Name", example = "Colombo Branch")
    @NotBlank(message = "Branch Name is required")
    private String name;

    @Schema(description = "Location", example = "Colombo 07")
    private String location;

    @Schema(description = "Contact Email", example = "contact@hospital.com")
    private String contactEmail;

    @Schema(description = "Contact Phone", example = "+94112345678")
    private String contactPhone;

    @Schema(description = "Status", example = "Active")
    private String status;
}
