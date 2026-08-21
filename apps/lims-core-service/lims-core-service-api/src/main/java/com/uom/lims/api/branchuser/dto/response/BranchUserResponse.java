package com.uom.lims.api.branchuser.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.time.Instant;

@Data
public class BranchUserResponse {
    private String id;
    private String branchId;
    private String keycloakId;
    private String fullName;
    private String email;
    private String phone;
    private String role;
    @JsonProperty("isActive")
    private Boolean isActive;
    private String username;
    private String initials;
    private String bgColor;
    private String textColor;
    private String lastLogin;
    
    private Instant createdAt;
    private Instant updatedAt;
}
