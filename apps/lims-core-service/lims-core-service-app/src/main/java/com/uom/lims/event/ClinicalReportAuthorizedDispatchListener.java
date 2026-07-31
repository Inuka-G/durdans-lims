package com.uom.lims.event;

import com.uom.lims.dispatch.DispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class ClinicalReportAuthorizedDispatchListener {

    private final DispatchService dispatchService;

    /**
     * Runs after the clinical-authorization transaction commits, still on the request thread
     * (no {@code @Async}) so the dispatch row exists before the REST response is returned and
     * {@link org.springframework.security.core.context.SecurityContext} remains available for audit.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleClinicalAuthorization(ClinicalReportAuthorizedEvent event) {
        try {
            dispatchService.registerAuthorizedReportSystem(event.request(), event.auditSource());
            log.info("Registered report {} for dispatch after clinical authorization", event.request().getReportReference());
        } catch (Exception exception) {
            log.error("Failed to register dispatch item after clinical authorization for report {}",
                    event.request().getReportReference(), exception);
        }
    }
}
