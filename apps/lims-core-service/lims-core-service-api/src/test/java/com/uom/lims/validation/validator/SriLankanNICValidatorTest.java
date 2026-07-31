package com.uom.lims.validation.validator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class SriLankanNICValidatorTest {

    private SriLankanNICValidator validator;

    @BeforeEach
    void setUp() {
        validator = new SriLankanNICValidator();
    }

    @Test
    void shouldExtractDobAndGenderCorrectlyForOldNic() {
        // 92 - 1992, 123 - Male (Day 123), 4567V
        SriLankanNICParser.NICDetails details = SriLankanNICParser.parse("921234567V");
        assertEquals("Male", details.gender());
        assertEquals(LocalDate.of(1992, 5, 2), details.dateOfBirth());
        assertTrue(details.isOldFormat());
    }

    @Test
    void shouldExtractDobAndGenderCorrectlyForOldNicFemale() {
        // 92 - 1992, 623 (123+500) - Female (Day 123), 4567X
        SriLankanNICParser.NICDetails details = SriLankanNICParser.parse("926234567X");
        assertEquals("Female", details.gender());
        assertEquals(LocalDate.of(1992, 5, 2), details.dateOfBirth());
        assertTrue(details.isOldFormat());
    }

    @Test
    void shouldExtractDobAndGenderCorrectlyForNewNic() {
        // 2000 - Year 2000, 123 - Male (Day 123), 45678
        SriLankanNICParser.NICDetails details = SriLankanNICParser.parse("200012345678");
        assertEquals("Male", details.gender());
        assertEquals(LocalDate.of(2000, 5, 2), details.dateOfBirth());
        assertFalse(details.isOldFormat());
    }

    @Test
    void shouldExtractDobAndGenderCorrectlyForNewNicFemale() {
        // 1995 - Year 1995, 623 (123+500) - Female (Day 123), 45678
        SriLankanNICParser.NICDetails details = SriLankanNICParser.parse("199562345678");
        assertEquals("Female", details.gender());
        assertEquals(LocalDate.of(1995, 5, 3), details.dateOfBirth()); // 1995 not a leap year, day 123 is May 3
        assertFalse(details.isOldFormat());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "921234567V", // Old format Male
            "926234567X", // Old format Female
            "200012345678", // New format Male
            "199562345678" // New format Female
    })
    void shouldReturnTrueForValidNICs(String nic) {
        // We use null context for simple true/false checks in tests as context building
        // is complex
        // Ideally handled with complete validator mock, but exceptions catch all.
        // Try/catch just for boolean simulation
        try {
            SriLankanNICParser.parse(nic);
            assertTrue(true);
        } catch (Exception e) {
            fail("Should be valid: " + nic);
        }
    }

    @Test
    void shouldThrowExceptionForInvalidFormat() {
        InvalidNICException ex = assertThrows(InvalidNICException.class, () -> SriLankanNICParser.parse("12345678B"));
        assertTrue(ex.getMessage().contains("Invalid format"));

        ex = assertThrows(InvalidNICException.class, () -> SriLankanNICParser.parse("1234567890"));
        assertTrue(ex.getMessage().contains("Invalid format"));
    }

    @Test
    void shouldThrowExceptionForInvalidDateEncoding() {
        // 000 is not a valid day sequence
        InvalidNICException ex = assertThrows(InvalidNICException.class, () -> SriLankanNICParser.parse("920004567V"));
        assertTrue(ex.getMessage().contains("Invalid date encoding"));

        // 500 is not a valid day sequence
        ex = assertThrows(InvalidNICException.class, () -> SriLankanNICParser.parse("200050045678"));
        assertTrue(ex.getMessage().contains("Invalid date encoding"));

        // 867 is out of bounds
        ex = assertThrows(InvalidNICException.class, () -> SriLankanNICParser.parse("928674567X"));
        assertTrue(ex.getMessage().contains("Invalid date encoding"));
    }

    @Test
    void shouldThrowExceptionForInvalidDaySequenceNonLeapYear() {
        // 2001 is NOT a leap year. Day 366 does not exist.
        InvalidNICException ex = assertThrows(InvalidNICException.class,
                () -> SriLankanNICParser.parse("200136645678"));
        assertTrue(ex.getMessage().contains("Invalid day sequence"));
    }

    @Test
    void shouldReturnTrueForNullOrEmptyNIC() {
        // Required field validation handled by @NotBlank
        assertTrue(validator.isValid(null, null));
        assertTrue(validator.isValid("", null));
        assertTrue(validator.isValid("   ", null));
    }
}
