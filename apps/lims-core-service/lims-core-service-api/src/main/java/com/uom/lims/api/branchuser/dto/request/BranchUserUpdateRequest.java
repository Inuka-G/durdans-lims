package com.uom.lims.api.branchuser.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class BranchUserUpdateRequest {
    
    @NotBlank(message = "Full name is required")
    private String fullName;
    
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;
    
    @NotBlank(message = "Role is required")
    private String role;
    
    private String phone;
    
    private String username;
    
    @NotNull(message = "Active status is required")
    @JsonProperty("isActive")
    private Boolean isActive;
}
