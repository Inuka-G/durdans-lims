package com.uom.lims.audit;

import lombok.Data;

@Data
public class AuditLogResponse {
    private String id;
    private String action;
    private String entityType;
    private String entityId;
    private String patientCode;
    private String performedBy;
    private String branchCode;
    private String ipAddress;
    private String timestamp;
    private String details;
}
