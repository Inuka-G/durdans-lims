/**
 * Report dispatch and delivery API.
 *
 * <p><b>Lab integration contract (MLT / results module)</b></p>
 * <ul>
 *   <li><b>reportReference</b> — stable business identifier for the authorized report (e.g. REP-2023-9901).
 *       Unique together with {@code branchCode} for idempotent registration.</li>
 *   <li><b>branchCode</b> — branch where the report was produced; dispatch queues are scoped by branch.</li>
 *   <li><b>patientCode</b> — optional link to {@code patient.patient_code} for resolving email/SMS on delivery.</li>
 *   <li><b>artifactUri</b> — optional URI to the final PDF or portal object; may be empty if print-only.</li>
 *   <li><b>Ingress</b> — {@code POST /api/v1/dispatch/reports/register} (REST, same payload) or Kafka topic
 *       {@code lab.report.authorized} with JSON body matching {@link com.uom.lims.api.dispatch.dto.request.RegisterAuthorizedReportRequest}.</li>
 * </ul>
 */
package com.uom.lims.api.dispatch;
