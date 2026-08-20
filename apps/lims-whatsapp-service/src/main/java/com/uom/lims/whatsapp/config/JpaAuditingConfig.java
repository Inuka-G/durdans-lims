package com.uom.lims.whatsapp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Enables the {@code @CreatedDate} / {@code @LastModifiedDate} population on
 * {@link com.uom.lims.whatsapp.domain.WaBaseEntity}.
 *
 * <p>Kept out of the application class deliberately. {@code @EnableJpaAuditing} there
 * would be pulled into every {@code @WebMvcTest} slice, which has no JPA metamodel, and
 * every web-layer test would fail to start a context for reasons that have nothing to do
 * with the web layer.
 */
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
}
