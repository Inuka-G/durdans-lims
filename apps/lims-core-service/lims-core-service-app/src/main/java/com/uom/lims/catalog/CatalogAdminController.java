package com.uom.lims.catalog;

import com.uom.lims.api.catalog.dto.request.CatalogTranslationRequest;
import com.uom.lims.api.catalog.dto.request.TestPackageUpsertRequest;
import com.uom.lims.api.catalog.dto.response.TestPackageResponse;
import com.uom.lims.api.catalog.dto.response.TranslationCoverageResponse;
import com.uom.lims.api.dto.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * WHY: staff-facing management of packages and catalogue translations.
 *
 * <p>The authorisation split here is the point. Defining and pricing a package is an
 * administrative act; <em>approving a Sinhala or Tamil rendering of a medical term</em>
 * is a clinical one, and it is the last check before that wording is spoken to a patient.
 * So review is restricted to clinical roles and cannot be done by whoever typed it.
 */
@RestController
@RequestMapping("/api/v1/admin/catalog")
@RequiredArgsConstructor
@Tag(name = "Catalog Administration", description = "Packages, pricing and translations")
public class CatalogAdminController {

    private final TestPackageService packageService;
    private final CatalogTranslationService translationService;

    // ---- Packages ----

    @Operation(summary = "List packages", description = "Active packages, English.")
    @GetMapping("/packages")
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN','BILLING_OFFICER','LAB_SUPERVISOR')")
    public ResponseEntity<ApiResponse<List<TestPackageResponse>>> listPackages(
            @RequestParam(name = "locale", required = false) String locale) {
        return ResponseEntity.ok(ApiResponse.success(packageService.listActive(locale)));
    }

    @Operation(summary = "Create or update a package",
            description = "Replaces the item list wholesale. A package cannot be activated without a price.")
    @PutMapping("/packages")
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<TestPackageResponse>> upsertPackage(
            @Valid @RequestBody TestPackageUpsertRequest request) {
        return ResponseEntity.ok(ApiResponse.success(packageService.upsert(request)));
    }

    @Operation(summary = "Activate or deactivate a package",
            description = "Activation is the moment a package becomes quotable to a patient.")
    @PostMapping("/packages/{packageCode}/active")
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> setPackageActive(
            @PathVariable String packageCode,
            @RequestParam boolean active) {
        packageService.setActive(packageCode, active);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Operation(summary = "Withdraw a package",
            description = "Soft delete — the row survives because past orders and receipts reference it.")
    @DeleteMapping("/packages/{packageCode}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deletePackage(@PathVariable String packageCode) {
        packageService.delete(packageCode);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ---- Translations ----

    @Operation(summary = "Save a test translation",
            description = "Saves as a draft. Drafts are never served to patients; review publishes them.")
    @PutMapping("/tests/{testCode}/translations")
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN','LAB_SUPERVISOR')")
    public ResponseEntity<ApiResponse<Void>> saveTestTranslation(
            @PathVariable String testCode,
            @Valid @RequestBody CatalogTranslationRequest request) {
        translationService.saveTestTranslation(testCode, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Operation(summary = "Approve a test translation",
            description = "Clinical sign-off. Until this runs the agent answers in English.")
    @PostMapping("/tests/{testCode}/translations/{locale}/review")
    @PreAuthorize("hasAnyRole('PATHOLOGIST','LAB_SUPERVISOR','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> reviewTestTranslation(
            @PathVariable String testCode,
            @PathVariable String locale,
            @AuthenticationPrincipal Jwt jwt) {
        translationService.reviewTestTranslation(testCode, locale, reviewerOf(jwt));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Operation(summary = "Save a package translation")
    @PutMapping("/packages/{packageCode}/translations")
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN','LAB_SUPERVISOR')")
    public ResponseEntity<ApiResponse<Void>> savePackageTranslation(
            @PathVariable String packageCode,
            @Valid @RequestBody CatalogTranslationRequest request) {
        translationService.savePackageTranslation(packageCode, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Operation(summary = "Approve a package translation")
    @PostMapping("/packages/{packageCode}/translations/{locale}/review")
    @PreAuthorize("hasAnyRole('PATHOLOGIST','LAB_SUPERVISOR','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> reviewPackageTranslation(
            @PathVariable String packageCode,
            @PathVariable String locale,
            @AuthenticationPrincipal Jwt jwt) {
        translationService.reviewPackageTranslation(packageCode, locale, reviewerOf(jwt));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Operation(summary = "Translation coverage",
            description = "Percentage complete plus the outstanding test codes, so the gap is a work list.")
    @GetMapping("/translations/coverage")
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN','LAB_SUPERVISOR','PATHOLOGIST')")
    public ResponseEntity<ApiResponse<TranslationCoverageResponse>> coverage(
            @RequestParam String locale) {
        return ResponseEntity.ok(ApiResponse.success(translationService.coverage(locale)));
    }

    /**
     * Who signed the translation off. Recorded as the token's preferred_username so the
     * approval is attributable to a person, not to "the system" — this is a clinical
     * sign-off and it needs a name against it.
     */
    private static String reviewerOf(Jwt jwt) {
        if (jwt == null) {
            return "unknown";
        }
        String username = jwt.getClaimAsString("preferred_username");
        return username == null || username.isBlank() ? jwt.getSubject() : username;
    }
}
