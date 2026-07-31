package com.uom.lims.validation.validator;

import com.uom.lims.validation.annotation.PassportNumber;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;

public class PassportNumberValidator implements ConstraintValidator<PassportNumber, String> {

    // Matches: 1 or 2 uppercase letters followed by exactly 7 digits
    // N1234567, M1234567, PA1234567
    private static final String PASSPORT_REGEX = "^[A-Z]{1,2}\\d{7}$";
    private static final Pattern PATTERN = Pattern.compile(PASSPORT_REGEX);

    @Override
    public void initialize(PassportNumber constraintAnnotation) {
        // No initialization needed
    }

    @Override
    public boolean isValid(String passport, ConstraintValidatorContext context) {
        // Null or blank values are valid.
        // Use @NotBlank separately for required fields to keep validation
        // single-responsibility.
        if (passport == null || passport.trim().isEmpty()) {
            return true;
        }

        return PATTERN.matcher(passport).matches();
    }
}
