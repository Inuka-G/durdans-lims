package com.uom.lims.api.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderTrackingEventResponse {
    private String id;
    private String stage;
    private String title;
    private String description;
    private String status;
    private String timestamp;
    private String performedBy;
    private String testName;
    private String barcode;
    private String method;
    private String trackingNumber;
    private String trackingUrl;
}
