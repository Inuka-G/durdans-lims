# Durdans LIMS Core Service

Enterprise backend service for Durdans Hospital Laboratory Information Management System (LIMS), built with Java 21 and Spring Boot.

![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5-6DB33F?logo=springboot&logoColor=white)
![Gradle](https://img.shields.io/badge/Gradle-02303A?logo=gradle&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white)
![JPA](https://img.shields.io/badge/JPA-Hibernate-59666C?logo=hibernate&logoColor=white)
![Liquibase](https://img.shields.io/badge/Liquibase-2962FF?logo=liquibase&logoColor=white)
![Keycloak](https://img.shields.io/badge/Keycloak-4D4D4D?logo=keycloak&logoColor=white)
![Kafka](https://img.shields.io/badge/Kafka-231F20?logo=apachekafka&logoColor=white)
![AWS S3](https://img.shields.io/badge/AWS_S3-569A31?logo=amazons3&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Overview

This service owns the core laboratory workflows and APIs, including:

- patient and identity integration
- order and billing lifecycle
- sample collection, rejection, recollection, and tracking
- accessioning, MLT result entry, supervisor verification, and clinical authorization
- report dispatch and audit logging

## 🏗 Architecture

The repository uses a multi-module Gradle structure:

- `lims-core-service-api`: API contracts, DTOs, enums, and interface-level definitions
- `lims-core-service-app`: executable Spring Boot application with controllers, services, entities, repositories, security, and migrations

## 🧰 Tech Stack

- Java 21
- Spring Boot 3.5
- Spring Data JPA + PostgreSQL
- Liquibase
- Spring Security (OAuth2 Resource Server / JWT)
- Keycloak (identity and access)
- Kafka (event workflows)
- AWS SDK v2 (S3 integration)
- Caffeine cache
- Spring Mail
- OpenAPI/Swagger
- Gradle

## ✅ Prerequisites

Before running locally, ensure these dependencies are available:

- JDK 21
- PostgreSQL
- Keycloak
- Kafka
- LocalStack (if using local S3 emulation)

If you use the infrastructure repository, start required containers first.

## 🗂 Repository Layout

- `build.gradle`, `settings.gradle`: root multi-module build config
- `lims-core-service-app/src/main/resources/application.yml`: main app configuration
- `lims-core-service-app/src/main/resources/liquibase`: DB changelogs

## 🚀 Running Locally

From `lims-core-service`:

```bash
./gradlew clean build
./gradlew :lims-core-service-app:bootRun
```

Default API base:

- `http://localhost:11000`

To run with a local profile:

```bash
./gradlew :lims-core-service-app:bootRun --args='--spring.profiles.active=local'
```

## 🛠 Build Commands

- `./gradlew clean build` - compile + test + package modules
- `./gradlew :lims-core-service-app:bootRun` - run app module
- `./gradlew :lims-core-service-app:test` - run app tests

## 📘 API Documentation

When the app is running:

- Swagger UI: `http://localhost:11000/swagger-ui.html`

## 🔐 Configuration and Security Guidance

- Keep base `application.yml` limited to safe defaults.
- Store secrets in environment variables or local profile overrides (for example `application-local.yml`, ignored by git).
- Do not commit real credentials, tokens, or private endpoints.
- Keep `.gitignore` aligned to exclude local IDE/AI artifacts and environment-specific files.

## 📋 Production Readiness Checklist

- externalize all credentials and sensitive values
- enforce environment-specific configs (dev/stage/prod)
- validate migration execution in target environment
- enable observability (logs, metrics, tracing) and alerting
- verify role-based access controls for all critical endpoints

## 🩺 Troubleshooting

- **Startup fails on DB connection**: validate datasource URL, user, password, and DB port.
- **401/403 errors**: verify Keycloak issuer/client/role configuration and JWT validity.
- **Migration errors**: inspect Liquibase changelog order and applied history.
- **Kafka-related failures**: verify broker availability and topic configuration.
