package com.uom.lims.api.dto.request;

import com.uom.lims.api.enums.TubeType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class SupplyCreateRequest {

    @NotBlank
    @Size(max = 50, message = "Item number must be 50 characters or fewer")
    private String itemNo;

    @NotBlank
    private String name;

    private String category;

    /**
     * WHY: Left unconstrained so the request may name the tube directly or name a test and
     * let the service borrow that test's tube; the service rejects a request carrying neither.
     */
    private TubeType tubeType;

    /**
     * WHY: A test is only a familiar name for the tube it needs — the service resolves
     * the test's tubeType and stocks that. Stock is pooled per tube, not per test, so
     * two tests drawing the same tube share one row.
     */
    private UUID testId;

    @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Tube colour must be a 6-digit hex colour, e.g. #a855f7")
    private String tubeColor;

    @NotNull
    @Min(0)
    private Integer currentStock;

    @NotNull
    @Min(0)
    private Integer minStock;

    @NotNull
    @Min(0)
    private Integer maxStock;

    private String unit;

    private String lastRestocked;
}
