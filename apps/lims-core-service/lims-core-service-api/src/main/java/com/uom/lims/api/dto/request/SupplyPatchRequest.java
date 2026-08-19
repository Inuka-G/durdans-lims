package com.uom.lims.api.dto.request;

import com.uom.lims.api.enums.TubeType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SupplyPatchRequest {

    private String name;
    private String category;
    private TubeType tubeType;

    @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Tube colour must be a 6-digit hex colour, e.g. #a855f7")
    private String tubeColor;

    @Min(0)
    private Integer currentStock;

    @Min(0)
    private Integer minStock;

    @Min(0)
    private Integer maxStock;

    private String unit;
    private String lastRestocked;

    /**
     * WHY: A stock-take writes an absolute count, which is only correct if nothing moved
     * between reading the row and counting the shelf. Sending the version the count was
     * based on lets the server refuse a write that would erase a collection or a restock.
     * Optional, so callers that touch no stock keep working unchanged.
     */
    private Long expectedVersion;
}
