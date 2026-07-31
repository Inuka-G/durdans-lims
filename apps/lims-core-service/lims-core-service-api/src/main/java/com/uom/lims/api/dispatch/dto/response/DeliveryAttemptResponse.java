package com.uom.lims.api.dispatch.dto.response;

import com.uom.lims.api.dispatch.enums.DeliveryAttemptStatus;
import com.uom.lims.api.dispatch.enums.DeliveryMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryAttemptResponse {

    private UUID id;
    private DeliveryMethod method;
    private DeliveryAttemptStatus status;
    private String failureReason;
    private int retryCount;
    private OffsetDateTime dispatchedAt;
    private OffsetDateTime deliveredAt;
    private String recipientContact;
    private String trackingNumber;
    private String trackingUrl;
}
