package com.uom.lims;

import org.junit.jupiter.api.Test;

/**
 * Boots the entire application context against a real Postgres. This is the single
 * cheapest, highest-value safety net: it transitively instantiates every controller,
 * service, repository and configuration bean, so any unsatisfiable dependency fails
 * the build.
 *
 * <p>It is exactly the test that would have caught the {@code ComplianceController}
 * → {@code ClientIpResolver} wiring bug (a static utility injected as a bean) that
 * previously only surfaced when the container crash-looped at runtime.
 */
class ApplicationContextLoadsTest extends AbstractIntegrationTest {

    @Test
    void contextLoads() {
        // Intentionally empty — success is the context starting without error.
    }
}
