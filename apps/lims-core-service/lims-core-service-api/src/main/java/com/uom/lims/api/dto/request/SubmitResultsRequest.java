package com.uom.lims.api.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record SubmitResultsRequest(

        @NotNull(message = "Sample id is required") UUID sampleId,

        @NotEmpty(message = "Results are required") List<@Valid ResultItemRequest> results,

        @Size(max = 500, message = "MLT notes must be less than 500 characters") String mltNotes) {
}