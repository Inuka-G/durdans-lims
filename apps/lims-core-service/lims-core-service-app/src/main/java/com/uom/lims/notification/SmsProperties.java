package com.uom.lims.notification;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Configuration for the selected outbound SMS gateway. */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.sms")
public class SmsProperties {

    private String provider = "mock";
    private String endpoint = "http://sms.ozonedesk.com/api/v1/send.php";
    private String userId;
    private String apiKey;
    private String senderId;
}
