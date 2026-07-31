package com.uom.lims.api.document;

import com.uom.lims.api.common.PageResponse;
import com.uom.lims.api.common.enums.DocumentType;
import com.uom.lims.api.document.dto.request.DocumentUpdateRequest;
import com.uom.lims.api.document.dto.response.DocumentResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RequestMapping("/api/v1/patients/{patientCode}/documents")
@Tag(name = "Patient Document Management", description = "Operations related to patient documents")
public interface DocumentApi {

        @Operation(summary = "Upload a document", description = "Uploads a new document for a patient")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "201", description = "Document uploaded successfully", content = @Content(mediaType = "application/json", schema = @Schema(implementation = DocumentResponse.class))),
                        @ApiResponse(responseCode = "400", description = "Invalid input data", content = @Content),
                        @ApiResponse(responseCode = "404", description = "Patient not found", content = @Content)
        })
        @PostMapping(consumes = "multipart/form-data")
        @ResponseStatus(HttpStatus.CREATED)
        DocumentResponse uploadDocument(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode,

                        @Parameter(description = "Type of the document", required = true) @RequestParam("documentType") DocumentType documentType,

                        @Parameter(description = "Description of the document") @RequestParam(value = "description", required = false) String description,

                        @Parameter(description = "File to upload", required = true) @RequestParam("file") MultipartFile file);

        @Operation(summary = "List documents", description = "List all documents for a patient with pagination")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "List of documents retrieved", content = @Content(mediaType = "application/json", schema = @Schema(implementation = PageResponse.class)))
        })
        @GetMapping
        @ResponseStatus(HttpStatus.OK)
        PageResponse<DocumentResponse> listDocuments(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode,

                        @Parameter(description = "Pagination information") @PageableDefault(size = 10) Pageable pageable);

        @Operation(summary = "Download document", description = "Get a presigned URL to download the document")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Download URL generated", content = @Content(mediaType = "text/plain", schema = @Schema(type = "string", example = "https://s3.amazonaws.com/..."))),
                        @ApiResponse(responseCode = "404", description = "Document not found", content = @Content)
        })
        @GetMapping("/{documentId}/download")
        @ResponseStatus(HttpStatus.OK)
        ResponseEntity<String> downloadDocument(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode,

                        @Parameter(description = "Unique document identifier", required = true) @PathVariable("documentId") UUID documentId);

        @Operation(summary = "Update document details", description = "Updates description of an existing document")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Document updated successfully", content = @Content(mediaType = "application/json", schema = @Schema(implementation = DocumentResponse.class))),
                        @ApiResponse(responseCode = "404", description = "Document not found", content = @Content)
        })
        @PatchMapping("/{documentId}")
        @ResponseStatus(HttpStatus.OK)
        DocumentResponse updateDocument(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode,

                        @Parameter(description = "Unique document identifier", required = true) @PathVariable("documentId") UUID documentId,

                        @Parameter(description = "Document update request", required = true) @Valid @RequestBody DocumentUpdateRequest request);

        @Operation(summary = "Delete document", description = "Soft deletes a document")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "204", description = "Document deleted successfully"),
                        @ApiResponse(responseCode = "404", description = "Document not found", content = @Content)
        })
        @DeleteMapping("/{documentId}")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        void deleteDocument(
                        @Parameter(description = "Unique patient code", required = true) @PathVariable("patientCode") String patientCode,

                        @Parameter(description = "Unique document identifier", required = true) @PathVariable("documentId") UUID documentId);
}
