package com.uom.lims.api.dto.request;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SupplyPatchRequest {

    private String name;
    private String category;
    private String tubeColor;

    @Min(0)
    private Integer currentStock;

    @Min(0)
    private Integer minStock;

    @Min(0)
    private Integer maxStock;

    private String unit;
    private String lastRestocked;
}
