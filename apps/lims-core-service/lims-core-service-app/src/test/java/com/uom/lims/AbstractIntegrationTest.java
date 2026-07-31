package com.uom.lims;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base class for DB-backed integration tests. Boots the full Spring context against
 * a real PostgreSQL container (Liquibase applies the real schema), so JPA mappings,
 * repository queries, transaction boundaries, and bean wiring are exercised the way
 * they run in production — the integration layer the audit found was missing.
 *
 * <p>Uses the <b>singleton container</b> pattern: one Postgres is started once for
 * the whole JVM and shared across every integration test class. This is faster and
 * far more stable than a per-class {@code @Container} (which starts/stops a fresh
 * container for each class and is flaky under a busy Docker daemon).
 *
 * <p>The Keycloak-backed {@link JwtDecoder} is replaced with a mock so tests need no
 * running identity provider; tests authenticate with {@code SecurityMockMvc...jwt()}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:15");

    static {
        POSTGRES.start();
    }

    @MockitoBean
    protected JwtDecoder jwtDecoder;
}
