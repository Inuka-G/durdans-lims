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

        @Size(max = 500, message = "MLT notes must be less than 500 characters") String mltNotes,

        /**
         * Which analyser produced these values, as a code from the instrument
         * registry — or BENCH-MANUAL for a genuine bench method.
         *
         * <p>Without it the QC gate cannot find the control that governs the
         * result, so it evaluates to NOT_EVALUATED and the result is neither
         * held nor vouched for. Optional on a draft; the verification gate is
         * what enforces it, because blocking data capture would only push MLTs
         * onto paper.
         */
        String instrumentCode) {
}