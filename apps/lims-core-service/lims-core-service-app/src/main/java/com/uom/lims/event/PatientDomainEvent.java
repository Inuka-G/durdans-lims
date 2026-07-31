package com.uom.lims.event;

import java.time.LocalDateTime;

public record PatientDomainEvent(
                String eventType,
                String patientCode,
                String email,
                String phone,
                LocalDateTime timestamp) {
}
