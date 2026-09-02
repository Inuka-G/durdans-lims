package com.uom.lims.config;

import org.keycloak.OAuth2Constants;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Server-to-server Keycloak Admin client (client-credentials grant via a service
 * account). Used by the admin module to manage users/roles. Disabled unless
 * {@code app.keycloak-admin.enabled=true} so the app can start without admin
 * credentials in environments that don't need it.
 */
@Configuration
@ConditionalOnProperty(name = "app.keycloak-admin.enabled", havingValue = "true", matchIfMissing = true)
public class KeycloakAdminConfig {

    @Value("${app.keycloak-admin.server-url:http://localhost:8081}")
    private String serverUrl;

    @Value("${app.keycloak-admin.realm:lims-realm}")
    private String realm;

    @Value("${app.keycloak-admin.client-id:lims-admin-cli}")
    private String clientId;

    @Value("${app.keycloak-admin.client-secret:}")
    private String clientSecret;

    @Value("${app.keycloak-admin.admin-username:admin}")
    private String adminUsername;

    @Value("${app.keycloak-admin.admin-password:admin}")
    private String adminPassword;

    @Bean
    public Keycloak adminKeycloak() {
        if (clientSecret != null && !clientSecret.trim().isEmpty()) {
            return KeycloakBuilder.builder()
                    .serverUrl(serverUrl)
                    .realm(realm)
                    .grantType(OAuth2Constants.CLIENT_CREDENTIALS)
                    .clientId(clientId)
                    .clientSecret(clientSecret)
                    .build();
        } else {
            return KeycloakBuilder.builder()
                    .serverUrl(serverUrl)
                    .realm("master")
                    .grantType(OAuth2Constants.PASSWORD)
                    .clientId("admin-cli")
                    .username(adminUsername)
                    .password(adminPassword)
                    .build();
        }
    }
}
