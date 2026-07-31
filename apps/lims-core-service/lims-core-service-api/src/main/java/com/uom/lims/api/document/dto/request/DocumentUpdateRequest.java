package com.uom.lims.api.document.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "DocumentUpdateRequest", description = "Payload used to update document details")
public class DocumentUpdateRequest {

    @Size(max = 255, message = "Description cannot exceed 255 characters")
    @Schema(description = "Description of the document", example = "Updated description for the report")
    private String description;
}
