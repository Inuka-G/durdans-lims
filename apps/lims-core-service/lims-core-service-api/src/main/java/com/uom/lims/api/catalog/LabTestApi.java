package com.uom.lims.api.catalog;

import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.LabTestResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.List;

/**
 * WHY: Provides a standardized interface for fetching the lab test catalog,
 * ensuring the frontend has access to up-to-date pricing and test metadata.
 */
@RequestMapping("/api/v1/tests")
@Tag(name = "Lab Test Catalog", description = "Endpoints for retrieving the laboratory test catalog")
public interface LabTestApi {

    @Operation(summary = "Get all active tests", description = "Retrieves a list of all active laboratory tests available for ordering")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Successfully retrieved test catalog")
    })
    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<List<LabTestResponse>>> getAllActiveTests();
}
