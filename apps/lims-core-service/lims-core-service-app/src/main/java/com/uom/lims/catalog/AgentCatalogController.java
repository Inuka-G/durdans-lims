package com.uom.lims.catalog;

import com.uom.lims.api.catalog.dto.response.LocalizedTestResponse;
import com.uom.lims.api.catalog.dto.response.TestPackageResponse;
import com.uom.lims.api.dto.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * WHY: the catalogue read surface for the WhatsApp agent service.
 *
 * <p>Separate from {@code /api/v1/tests} rather than reusing it, for three reasons that
 * are all about blast radius:
 *
 * <ul>
 *   <li>The caller is a machine on a service account, not a member of staff. It gets its
 *       own role, {@code AGENT_READONLY}, which grants exactly these paths and nothing
 *       else — so widening a staff role later cannot widen the agent's reach.</li>
 *   <li>Everything here is catalogue data: prices, names, preparation. No patient-scoped
 *       endpoint lives on this path, so a leaked agent token exposes a price list.</li>
 *   <li>The shape is patient-facing — localized, ranked, truncated to what fits in a
 *       WhatsApp list — which is not the shape the reception order form wants.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/agent/catalog")
@RequiredArgsConstructor
@PreAuthorize("hasRole('AGENT_READONLY')")
@Tag(name = "Agent Catalog", description = "Localized catalogue reads for the WhatsApp agent")
public class AgentCatalogController {

    private final AgentCatalogService agentCatalogService;
    private final CatalogTranslationService translationService;

    @Operation(summary = "Search tests",
            description = "Ranked matches across code, English name, localized name and colloquial name.")
    @GetMapping("/tests")
    public ResponseEntity<ApiResponse<List<LocalizedTestResponse>>> searchTests(
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(name = "locale", required = false) String locale) {
        return ResponseEntity.ok(ApiResponse.success(agentCatalogService.searchTests(query, locale)));
    }

    @Operation(summary = "List active packages",
            description = "Bundle price, what the same tests cost individually, and the saving.")
    @GetMapping("/packages")
    public ResponseEntity<ApiResponse<List<TestPackageResponse>>> listPackages(
            @RequestParam(name = "locale", required = false) String locale) {
        return ResponseEntity.ok(ApiResponse.success(agentCatalogService.listPackages(locale)));
    }

    @Operation(summary = "Get one package")
    @GetMapping("/packages/{packageCode}")
    public ResponseEntity<ApiResponse<TestPackageResponse>> getPackage(
            @PathVariable String packageCode,
            @RequestParam(name = "locale", required = false) String locale) {
        return ResponseEntity.ok(ApiResponse.success(agentCatalogService.getPackage(packageCode, locale)));
    }

    @Operation(summary = "Recognition vocabulary",
            description = "Test names in every form a patient might say them, for priming the voice model.")
    @GetMapping("/vocabulary")
    public ResponseEntity<ApiResponse<List<String>>> vocabulary(
            @RequestParam(name = "locale", required = false) String locale) {
        return ResponseEntity.ok(ApiResponse.success(agentCatalogService.vocabulary(locale)));
    }

    @Operation(summary = "Translation coverage",
            description = "How much of the catalogue the agent can actually answer for in this language.")
    @GetMapping("/coverage")
    public ResponseEntity<ApiResponse<com.uom.lims.api.catalog.dto.response.TranslationCoverageResponse>> coverage(
            @RequestParam(name = "locale") String locale) {
        return ResponseEntity.ok(ApiResponse.success(translationService.coverage(locale)));
    }
}
