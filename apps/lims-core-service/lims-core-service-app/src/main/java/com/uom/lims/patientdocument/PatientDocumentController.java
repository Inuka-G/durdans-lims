package com.uom.lims.patientdocument;

import com.uom.lims.api.document.DocumentApi;
import com.uom.lims.api.document.dto.request.DocumentUpdateRequest;
import com.uom.lims.api.document.dto.response.DocumentResponse;
import com.uom.lims.api.common.PageResponse;
import com.uom.lims.api.common.enums.DocumentType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import java.util.UUID;

@Slf4j
@RestController
public class PatientDocumentController implements DocumentApi {

    private final PatientDocumentService documentService;

    public PatientDocumentController(PatientDocumentService documentService) {
        this.documentService = documentService;
    }

    @PreAuthorize("hasAnyRole('FRONT_DESK','MLT','PHLEBOTOMIST')")
    @Override
    public DocumentResponse uploadDocument(
            @PathVariable String patientCode,
            @RequestParam DocumentType documentType,
            @RequestParam(required = false) String description,
            @RequestParam MultipartFile file) {

        try {
            // In a real scenario, use RequestContextHolder or similar to get IP
            // For this refactor, hardcoded as passing request is not in interface
            String ipAddress = "0.0.0.0";

            return documentService.uploadDocument(
                    patientCode,
                    documentType,
                    description,
                    file,
                    ipAddress);
        } catch (Exception e) {
            log.error("Document upload failed for patient: {}", patientCode, e);
            throw new RuntimeException("Failed to upload document: " + e.getMessage(), e);
        }
    }

    @PreAuthorize("hasAnyRole('FRONT_DESK','MLT','PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','PATHOLOGIST')")
    @Override
    public PageResponse<DocumentResponse> listDocuments(
            @PathVariable String patientCode,
            @PageableDefault(size = 10) Pageable pageable) {

        Page<DocumentResponse> pageResult = documentService.listDocuments(patientCode, pageable);

        return new PageResponse<>(
                pageResult.getContent(),
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages(),
                pageResult.isLast());
    }

    @PreAuthorize("hasAnyRole('FRONT_DESK','MLT','PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','PATHOLOGIST')")
    @Override
    public ResponseEntity<String> downloadDocument(
            @PathVariable String patientCode,
            @PathVariable UUID documentId) {

        String downloadUrl = documentService
                .generateDownloadUrl(patientCode, documentId);

        return ResponseEntity.ok(downloadUrl);
    }

    @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
    @Override
    public void deleteDocument(
            @PathVariable String patientCode,
            @PathVariable UUID documentId) {

        String ipAddress = "0.0.0.0";
        documentService.softDeleteDocument(patientCode, documentId, ipAddress);
    }

    @PreAuthorize("hasAnyRole('FRONT_DESK','MLT','PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN')")
    @Override
    public DocumentResponse updateDocument(
            @PathVariable String patientCode,
            @PathVariable UUID documentId,
            @Valid @RequestBody DocumentUpdateRequest request) {

        String ipAddress = "0.0.0.0";
        return documentService.updateDocument(
                patientCode,
                documentId,
                request.getDescription(),
                ipAddress);
    }
}
