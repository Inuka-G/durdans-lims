package com.uom.lims.validation.validator;

import com.uom.lims.validation.annotation.DrivingLicenseNumber;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;

public class DrivingLicenseNumberValidator implements ConstraintValidator<DrivingLicenseNumber, String> {

    // Matches: strictly Alphanumeric characters
    // Length: 7 to 10 characters
    // Supports numeric-only legacy format and modern B1234567 format
    // Rejects spaces, dashes, dots, and any special characters.
    private static final String LICENSE_REGEX = "^[A-Za-z0-9]{7,10}$";
    private static final Pattern PATTERN = Pattern.compile(LICENSE_REGEX);

    @Override
    public void initialize(DrivingLicenseNumber constraintAnnotation) {
        // No initialization needed
    }

    @Override
    public boolean isValid(String licenseNumber, ConstraintValidatorContext context) {
        // Null or blank values are considered valid here to maintain single
        // responsibility.
        // Use @NotBlank for required structural validation.
        if (licenseNumber == null || licenseNumber.trim().isEmpty()) {
            return true;
        }

        return PATTERN.matcher(licenseNumber).matches();
    }
}
