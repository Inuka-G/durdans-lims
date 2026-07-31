package com.uom.lims.validation.validator;

import java.time.DateTimeException;
import java.time.LocalDate;

/**
 * Enterprise-grade parser and logic extractor for Sri Lankan National Identity
 * Cards (NIC).
 * Supports both Old (9 digits + V/X) and New (12 digits) formats.
 */
public class SriLankanNICParser {

    public record NICDetails(LocalDate dateOfBirth, String gender, String normalizedNic, boolean isOldFormat) {
    }

    public static NICDetails parse(String nic) {
        if (nic == null || nic.trim().isEmpty()) {
            throw new IllegalArgumentException("NIC cannot be null or blank");
        }

        String normalized = nic.trim().toUpperCase();

        boolean isOldFormat;
        if (normalized.matches("^[0-9]{9}[VX]$")) {
            isOldFormat = true;
        } else if (normalized.matches("^[0-9]{12}$")) {
            isOldFormat = false;
        } else {
            throw new InvalidNICException("Invalid format: Must be 9 digits followed by V/X or 12 digits");
        }

        String yearStr;
        String dayStr;

        if (isOldFormat) {
            yearStr = "19" + normalized.substring(0, 2);
            dayStr = normalized.substring(2, 5);
        } else {
            yearStr = normalized.substring(0, 4);
            dayStr = normalized.substring(4, 7);
        }

        int year = Integer.parseInt(yearStr);
        int days = Integer.parseInt(dayStr);

        // Standard Sri Lankan NIC logic encodes gender by adding 500 to the days for
        // females.
        // Valid ranges are 1-366 (Male) and 501-866 (Female).
        if (days == 0 || days == 500 || days > 866 || (days > 366 && days < 501)) {
            throw new InvalidNICException("Invalid date encoding: Unrecognized day sequence");
        }

        String gender = "Male";
        if (days > 500) {
            days -= 500;
            gender = "Female";
        }

        try {
            LocalDate dob = LocalDate.ofYearDay(year, days);
            return new NICDetails(dob, gender, normalized, isOldFormat);

        } catch (DateTimeException e) {
            throw new InvalidNICException(
                    "Invalid day sequence: Does not correspond to a valid date in the year " + year);
        }
    }
}
