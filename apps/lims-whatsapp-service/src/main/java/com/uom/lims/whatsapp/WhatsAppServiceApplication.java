package com.uom.lims.whatsapp;

import com.uom.lims.whatsapp.config.MetaProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * WHY: the WhatsApp agent runs as its own service, outside lims-core-service.
 * It carries a public internet ingress (Meta's webhook) and, later, an LLM client;
 * neither belongs inside the clinical core. It reaches patient data only through
 * lims-core-service's HTTP API under a read-only Keycloak service account, so a
 * defect here cannot reach a specimen record.
 */
@SpringBootApplication
@EnableConfigurationProperties(MetaProperties.class)
public class WhatsAppServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(WhatsAppServiceApplication.class, args);
    }
}
