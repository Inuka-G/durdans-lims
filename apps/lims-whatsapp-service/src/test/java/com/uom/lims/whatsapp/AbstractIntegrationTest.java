package com.uom.lims.whatsapp;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Runs the service against a real PostgreSQL with the real Liquibase changelog applied.
 *
 * <p>An in-memory database would not prove the thing that matters here: idempotency
 * depends on a unique index actually rejecting a second insert, which is behaviour of
 * the database, not of the mapping. The container is static so every test class in the
 * suite shares one instance.
 */
@Testcontainers
@SpringBootTest
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:15-alpine")
                    .withDatabaseName("durdans_wa_db")
                    .withUsername("test")
                    .withPassword("test");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        // Meta credentials are irrelevant to persistence tests, but the properties must
        // bind for the context to start.
        registry.add("app.meta.app-secret", () -> "test-app-secret");
        registry.add("app.meta.verify-token", () -> "test-verify-token");
    }
}
