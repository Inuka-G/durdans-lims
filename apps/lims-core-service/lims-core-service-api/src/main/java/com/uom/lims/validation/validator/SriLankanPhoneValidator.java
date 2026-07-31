package com.uom.lims.validation.validator;

import com.uom.lims.validation.annotation.SriLankanPhone;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;

public class SriLankanPhoneValidator implements ConstraintValidator<SriLankanPhone, String> {

    // Matches:
    // Local: 070, 071, 072, 074, 075, 076, 077, 078 followed by 7 digits
    // Int'l: +9470, +9471... followed by 7 digits
    // Optional: 9470, 9471... followed by 7 digits
    private static final String PHONE_REGEX = "^(?:0|\\+94|94)7[01245678]\\d{7}$";
    private static final Pattern PATTERN = Pattern.compile(PHONE_REGEX);

    @Override
    public void initialize(SriLankanPhone constraintAnnotation) {
        // No initialization needed
    }

    @Override
    public boolean isValid(String phoneNumber, ConstraintValidatorContext context) {
        // Null or blank values are valid.
        // Use @NotBlank separately for required fields to keep validation
        // single-responsibility.
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            return true;
        }

        return PATTERN.matcher(phoneNumber).matches();
    }
}
