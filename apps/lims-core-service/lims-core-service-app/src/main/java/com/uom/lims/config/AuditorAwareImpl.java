package com.uom.lims.config;

import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class AuditorAwareImpl implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }

        if (authentication instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jwtToken) {
            var attrs = jwtToken.getTokenAttributes();
            Object name = attrs.get("name");
            if (name != null && !name.toString().isBlank()) {
                return Optional.of(name.toString());
            }

            Object given = attrs.get("given_name");
            Object family = attrs.get("family_name");
            String combined = ((given != null ? given.toString() : "") + " " + (family != null ? family.toString() : "")).trim();
            if (!combined.isBlank()) {
                return Optional.of(combined);
            }

            Object username = attrs.get("preferred_username");
            if (username != null) return Optional.of(username.toString());
        }

        return Optional.of(authentication.getName());
    }
}
