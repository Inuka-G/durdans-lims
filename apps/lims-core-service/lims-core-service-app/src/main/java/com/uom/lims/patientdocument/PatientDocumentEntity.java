package com.uom.lims.patientdocument;

import com.uom.lims.entity.BaseEntity;
import com.uom.lims.api.common.enums.DocumentType;
import com.uom.lims.patient.PatientEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
@Entity
@Table(name = "patient_document", uniqueConstraints = {
        @UniqueConstraint(name = "uk_patient_file_hash", columnNames = { "patient_id", "file_hash" })
})
public class PatientDocumentEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private PatientEntity patient;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false)
    private DocumentType documentType;

    @Column(name = "original_file_name", nullable = false)
    private String originalFileName;

    @Column(name = "stored_file_name", nullable = false)
    private String storedFileName;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "s3_key", nullable = false, unique = true)
    private String s3Key;

    @Column(name = "description")
    private String description;

    @Column(name = "branch_code", nullable = false, length = 20)
    private String branchCode;

    @Column(name = "file_hash", nullable = false, length = 64)
    private String fileHash;

    @Column(name = "uploaded_by", nullable = false)
    private String uploadedBy;

    @Column(name = "uploaded_ip", nullable = false)
    private String uploadedIp;

}
