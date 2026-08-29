package com.uom.lims.api.superadmin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Superadmin User Response")
public class SuperadminUserResponse {
    private String id;
    private String username;
    private String email;
    private String fullName;
    private Boolean isActive;
    private String branchId;
    private List<String> roles;
    private String phone;
}
