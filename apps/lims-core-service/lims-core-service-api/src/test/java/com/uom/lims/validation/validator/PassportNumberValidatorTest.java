package com.uom.lims.validation.validator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PassportNumberValidatorTest {

    private PassportNumberValidator validator;

    @BeforeEach
    void setUp() {
        validator = new PassportNumberValidator();
        validator.initialize(null);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "N1234567",
            "M1234567",
            "P1234567",
            "PA1234567",
            "AB1234567"
    })
    void shouldReturnTrueForValidPassportNumbers(String passport) {
        assertTrue(validator.isValid(passport, null));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "n1234567", // lowercase 'n'
            "pa1234567", // lowercase 'p', 'a'
            "N123456", // 6 digits (too short)
            "N12345678", // 8 digits (too long)
            "1234567", // No letters
            "N123456A", // Letter at the end
            "N 1234567", // Space inside
            "N-1234567", // Special character
            "ABC1234567" // 3 letters (too many)
    })
    void shouldReturnFalseForInvalidPassportNumbers(String passport) {
        if (!passport.trim().isEmpty()) {
            assertFalse(validator.isValid(passport, null), "Should be invalid: " + passport);
        }
    }

    @Test
    void shouldReturnTrueForNullOrEmpty() {
        // Validation handles null and empty as valid, @NotBlank should handle empty
        // checking
        assertTrue(validator.isValid(null, null));
        assertTrue(validator.isValid("", null));
        assertTrue(validator.isValid("   ", null));
    }
}
