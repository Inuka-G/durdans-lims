package com.uom.lims.api.superadmin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Superadmin User Update Request")
public class SuperadminUserUpdateRequest {
    private String email;
    private String fullName;
    private String branchId;
    private String role;
    private Boolean isActive;
    private String phone;
}
