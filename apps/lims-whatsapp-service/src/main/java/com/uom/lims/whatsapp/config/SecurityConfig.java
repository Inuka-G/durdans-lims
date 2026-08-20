package com.uom.lims.whatsapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * This service publishes exactly one path to the internet, and it is not protected by a
 * credential — it is protected by the HMAC signature Meta puts on every delivery, which
 * {@link com.uom.lims.whatsapp.webhook.MetaSignatureVerifier} checks inside the
 * controller. Spring Security's job here is therefore narrow: let that one path through
 * and deny absolutely everything else, so a future controller added without thought is
 * not silently exposed.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // No browser ever calls this service. CORS is not configured because
                // there is no origin to allow, and CSRF does not apply to a
                // signature-authenticated, cookie-less endpoint.
                .cors(AbstractHttpConfigurer::disable)
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Meta's callback. Authenticated by X-Hub-Signature-256, not by
                        // anything Spring Security can check.
                        .requestMatchers("/webhook/whatsapp").permitAll()

                        // Actuator is served on the separate internal management port
                        // (11011), which is not published to the host or opened in the
                        // security group. On the public port these simply do not exist.
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus")
                        .permitAll()

                        .anyRequest().denyAll())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable);
        return http.build();
    }
}
