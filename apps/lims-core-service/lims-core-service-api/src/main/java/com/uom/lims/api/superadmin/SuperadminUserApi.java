package com.uom.lims.api.superadmin;

import com.uom.lims.api.superadmin.dto.ResetPasswordRequest;
import com.uom.lims.api.superadmin.dto.SuperadminUserResponse;
import com.uom.lims.api.superadmin.dto.SuperadminUserUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.List;

@RequestMapping("/api/v1/superadmin")
@Tag(name = "Superadmin User API", description = "Operations for global user management")
public interface SuperadminUserApi {

    @GetMapping("/users")
    @Operation(summary = "Get all users", description = "Retrieve a list of all Keycloak users in the system")
    List<SuperadminUserResponse> getAllUsers();

    @PutMapping("/users/{id}")
    @Operation(summary = "Update user", description = "Update a specific Keycloak user directly")
    SuperadminUserResponse updateSuperadminUser(@PathVariable String id, @RequestBody SuperadminUserUpdateRequest request);

    @PostMapping("/users/{id}/reset-password")
    @Operation(summary = "Reset user password", description = "Reset a user's Keycloak password manually")
    void resetUserPassword(@PathVariable String id, @RequestBody ResetPasswordRequest request);

    @GetMapping("/roles")
    @Operation(summary = "Get all roles", description = "Retrieve a list of all non-default roles in Keycloak")
    List<String> getRoles();
}
