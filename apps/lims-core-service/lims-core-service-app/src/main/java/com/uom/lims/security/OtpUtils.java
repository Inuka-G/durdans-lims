package com.uom.lims.security;

import java.security.SecureRandom;

public class OtpUtils {

    private static final SecureRandom secureRandom = new SecureRandom();

    public static String generateOtp() {
        int otp = 100000 + secureRandom.nextInt(900000);
        return String.valueOf(otp);
    }
}
