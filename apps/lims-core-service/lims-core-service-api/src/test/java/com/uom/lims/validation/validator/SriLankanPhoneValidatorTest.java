package com.uom.lims.validation.validator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SriLankanPhoneValidatorTest {

    private SriLankanPhoneValidator validator;

    @BeforeEach
    void setUp() {
        validator = new SriLankanPhoneValidator();
        validator.initialize(null);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "0701234567",
            "0711234567",
            "0721234567",
            "0741234567",
            "0751234567",
            "0761234567",
            "0771234567",
            "0781234567",
            "+94701234567",
            "+94771234567",
            "94701234567",
            "94771234567"
    })
    void shouldReturnTrueForValidSriLankanPhoneNumbers(String phone) {
        assertTrue(validator.isValid(phone, null));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "0731234567", // Invalid prefix 073
            "0791234567", // Invalid prefix 079
            "0112123456", // Landline, not a mobile
            "077123456", // Too short
            "07712345678", // Too long
            "+94731234567", // Invalid prefix +9473
            "94731234567", // Invalid prefix 9473
            "text", // Invalid format
            "0771234abc", // Letters in number
            " " // Blank string should be handled correctly by returning true (Null/Empty test
                // below uses blank)
    })
    void shouldReturnFalseForInvalidSriLankanPhoneNumbers(String phone) {
        if (!phone.trim().isEmpty()) {
            assertFalse(validator.isValid(phone, null), "Should be invalid: " + phone);
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
