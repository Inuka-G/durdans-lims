package com.uom.lims.api.document.dto.response;

import com.uom.lims.api.common.enums.DocumentType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Patient document details response")
public class DocumentResponse {

    @Schema(description = "Unique identifier of the document", example = "550e8400-e29b-41d4-a716-446655440000")
    private UUID documentId;

    @Schema(description = "Type of the document")
    private DocumentType documentType;

    @Schema(description = "Original file name", example = "lab_report.pdf")
    private String originalFileName;

    @Schema(description = "Description of the document", example = "Blood test report from external lab")
    private String description;

    @Schema(description = "MIME type of the file", example = "application/pdf")
    private String contentType;

    @Schema(description = "File size in bytes", example = "102400")
    private Long fileSize;

    @Schema(description = "Timestamp when the document was uploaded")
    private LocalDateTime uploadedAt;

    @Schema(description = "User who uploaded the document", example = "admin")
    private String uploadedBy;

    @Schema(description = "Branch where the document was uploaded", example = "Colombo")
    private String uploadedBranch;
}
