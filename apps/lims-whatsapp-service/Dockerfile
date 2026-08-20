# syntax=docker/dockerfile:1

# --- Build stage ---
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
# Copy the wrapper and build scripts first so dependency resolution is cached as its
# own layer and is not re-run on every source-only change.
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon || true
COPY . .
RUN ./gradlew bootJar --no-daemon

# --- Runtime stage ---
FROM eclipse-temurin:21-jre
WORKDIR /app
# curl is needed for the container HEALTHCHECK against the actuator readiness probe.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /usr/bin/pebble \
    && useradd -r -u 1001 lims
COPY --from=build --chown=lims:lims /workspace/build/libs/lims-whatsapp-service.jar /app/app.jar
USER lims
# 11010 = the Meta webhook, the only path exposed. 11011 = internal management/actuator,
# never published to the host.
EXPOSE 11010 11011
# Meta credentials come from the environment (see SECURITY.md) — never baked into the
# image. Readiness flips true only once Liquibase and the DB pool are up.
HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=5 \
    CMD curl -fsS http://localhost:11011/actuator/health/readiness || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
