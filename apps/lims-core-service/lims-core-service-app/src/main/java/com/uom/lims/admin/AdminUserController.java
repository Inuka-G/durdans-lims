package com.uom.lims.admin;

import com.uom.lims.api.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin user management. BRANCH_ADMIN operations are scoped to their own branch;
 * SUPER_ADMIN operates across all branches (enforced in the service).
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
@ConditionalOnProperty(name = "app.keycloak-admin.enabled", havingValue = "true")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AdminUserService.AdminUserResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(adminUserService.listUsers()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AdminUserService.AdminUserResponse>> create(
            @RequestBody AdminUserService.CreateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                adminUserService.createUser(request), "User created"));
    }

    @PatchMapping("/{id}/enabled")
    public ResponseEntity<ApiResponse<Void>> setEnabled(
            @PathVariable String id, @RequestParam boolean value) {
        adminUserService.setEnabled(id, value);
        return ResponseEntity.ok(ApiResponse.success(null, value ? "User enabled" : "User disabled"));
    }
}
