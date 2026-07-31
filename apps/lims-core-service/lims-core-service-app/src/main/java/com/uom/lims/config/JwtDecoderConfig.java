package com.uom.lims.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Decouples JWKS key fetching from issuer validation so the service can run inside
 * a container network while still validating tokens minted for the browser-facing
 * Keycloak URL.
 *
 * <p>This bean is created <strong>only</strong> when {@code app.security.jwt.jwk-set-uri}
 * is present (the {@code docker}/cloud profiles set it). When absent — the default
 * host-run profile — this bean does not exist, Spring Boot's normal
 * {@code spring.security.oauth2.resourceserver.jwt.issuer-uri} auto-configuration
 * applies unchanged, and the existing developer flow is completely unaffected.
 *
 * <p>Defining a {@link JwtDecoder} bean makes the auto-configured decoder back off
 * ({@code @ConditionalOnMissingBean}), so there is exactly one decoder at runtime.
 */
@Configuration
public class JwtDecoderConfig {

    @Bean
    @ConditionalOnProperty(name = "app.security.jwt.jwk-set-uri")
    public JwtDecoder jwtDecoder(
            @Value("${app.security.jwt.jwk-set-uri}") String jwkSetUri,
            @Value("${app.security.jwt.expected-issuer}") String expectedIssuer) {

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        // createDefaultWithIssuer validates exp, nbf (clock skew), and the issuer claim.
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(expectedIssuer));
        return decoder;
    }
}
