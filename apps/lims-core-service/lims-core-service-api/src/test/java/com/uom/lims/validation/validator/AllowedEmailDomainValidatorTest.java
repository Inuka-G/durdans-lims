package com.uom.lims.validation.validator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AllowedEmailDomainValidatorTest {

    private AllowedEmailDomainValidator validator;

    @BeforeEach
    void setUp() {
        validator = new AllowedEmailDomainValidator();
    }

    @Test
    void shouldReturnTrueWhenDomainsNotConfigured() {
        validator.setAllowedDomains(Collections.emptyList());
        assertTrue(validator.isValid("test@anydomain.com", null));

        validator.setAllowedDomains(null);
        assertTrue(validator.isValid("test@anydomain.com", null));
    }

    @Test
    void shouldReturnTrueForAllowedDomain() {
        validator.setAllowedDomains(Arrays.asList("durdans.com", "uom.lk"));
        assertTrue(validator.isValid("doctor@durdans.com", null));
        assertTrue(validator.isValid("student@uom.lk", null));
        assertTrue(validator.isValid("admin@Durdans.COM", null)); // Case insensitive check
    }

    @Test
    void shouldReturnFalseForDisallowedDomain() {
        validator.setAllowedDomains(Arrays.asList("durdans.com", "uom.lk"));
        assertFalse(validator.isValid("hacker@gmail.com", null));
        assertFalse(validator.isValid("test@yahoo.com", null));
    }

    @Test
    void shouldReturnTrueForNullOrEmpty() {
        // Handled by @NotBlank or @NotNull natively
        validator.setAllowedDomains(Arrays.asList("durdans.com"));
        assertTrue(validator.isValid(null, null));
        assertTrue(validator.isValid("   ", null));
        assertTrue(validator.isValid("", null));
    }

    @Test
    void shouldIgnoreMalformedEmailWithoutAtSymbol() {
        // @Email handles malformed checks, our validator should ignore it to not crash
        validator.setAllowedDomains(Arrays.asList("durdans.com"));
        assertTrue(validator.isValid("not-an-email", null));
    }
}
