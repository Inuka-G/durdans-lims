package com.uom.lims.audit;

import lombok.Data;

/**
 * Client-originated audit for revenue report screen (view / export intent).
 * {@code performedBy} and branch are taken from the security context server-side.
 */
@Data
public class RevenueReportAccessRequest {

    /**
     * {@code VIEW} when the report page is opened; {@code EXPORT} when user exports.
     */
    private String event;

    /** Optional context, e.g. selected period label. */
    private String detail;
}
