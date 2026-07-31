package com.uom.lims.api.dto.response;

import com.uom.lims.api.enums.PaymentMethod;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * WHY: Exposes individual transaction history details enabling auditing and receipt generation.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponse {
    private UUID id;
    private BigDecimal amount;
    private PaymentMethod paymentMethod;
    private Instant paymentDate;
    private boolean reversed;
    private String notes;
}
