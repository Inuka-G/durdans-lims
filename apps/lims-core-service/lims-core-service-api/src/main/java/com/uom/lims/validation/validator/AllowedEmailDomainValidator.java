package com.uom.lims.validation.validator;

import com.uom.lims.validation.annotation.AllowedEmailDomain;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import org.springframework.beans.factory.annotation.Value;

import java.util.List;

public class AllowedEmailDomainValidator implements ConstraintValidator<AllowedEmailDomain, String> {

    @Value("${app.validation.email.allowed-domains:}")
    private List<String> allowedDomains;

    @Override
    public void initialize(AllowedEmailDomain constraintAnnotation) {
        // Initialization not needed for this logic
    }

    @Override
    public boolean isValid(String email, ConstraintValidatorContext context) {
        // Null or blank strings are considered valid here, as @NotBlank handles
        // emptiness requirement independently.
        if (email == null || email.trim().isEmpty()) {
            return true;
        }

        // If no domains are configured in application.yml, it means no restriction is
        // applied.
        if (allowedDomains == null || allowedDomains.isEmpty()
                || (allowedDomains.size() == 1 && allowedDomains.get(0).trim().isEmpty())) {
            return true;
        }

        int atIndex = email.lastIndexOf('@');
        if (atIndex < 0) {
            return true; // Malformed emails without '@' are handled natively by @Email
        }

        String domain = email.substring(atIndex + 1).trim().toLowerCase();

        return allowedDomains.stream()
                .map(String::trim)
                .map(String::toLowerCase)
                .anyMatch(d -> d.equals(domain));
    }

    // Package-private setter for unit testing
    void setAllowedDomains(List<String> allowedDomains) {
        this.allowedDomains = allowedDomains;
    }
}
