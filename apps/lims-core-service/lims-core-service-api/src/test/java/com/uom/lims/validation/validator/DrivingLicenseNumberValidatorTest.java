package com.uom.lims.validation.validator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DrivingLicenseNumberValidatorTest {

    private DrivingLicenseNumberValidator validator;

    @BeforeEach
    void setUp() {
        validator = new DrivingLicenseNumberValidator();
        validator.initialize(null);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "B1234567", // Modern format (8 chars)
            "A123456789", // Modern format (10 chars)
            "1234567", // Legacy numeric (7 chars)
            "1234567890", // Legacy numeric (10 chars)
            "b1234567", // Modern format but lowercase allowed by regex
            "A1B2C3D4E5" // Alphanumeric max len
    })
    void shouldReturnTrueForValidDrivingLicenses(String license) {
        assertTrue(validator.isValid(license, null));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "B12345", // Too short (6 chars)
            "123456", // Legacy too short (6 chars)
            "B12345678901", // Too long (12 chars)
            "B-123456", // Dash special character
            "B 123456", // Space character
            "B_1234567", // Underscore
            "@1234567" // At symbol
    })
    void shouldReturnFalseForInvalidDrivingLicenses(String license) {
        if (!license.trim().isEmpty()) {
            assertFalse(validator.isValid(license, null), "Should be invalid: " + license);
        }
    }

    @Test
    void shouldReturnTrueForNullOrEmpty() {
        // Handled securely by @NotBlank validation layer separation
        assertTrue(validator.isValid(null, null));
        assertTrue(validator.isValid("", null));
        assertTrue(validator.isValid("   ", null));
    }
}
