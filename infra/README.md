# LIMS Infrastructure

This repository contains the core infrastructure required to run the locally hosted services for the Durdans Hospital LIMS project. This includes Keycloak for authentication and authorization, along with its backing PostgreSQL database.

## Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) (and Docker Compose)

## Setup and Run

To get the infrastructure up and running for development:

1. Clone this repository:
   ```bash
   git clone https://github.com/durdans-hospital-lims/lims-infrastructure.git
   cd lims-infrastructure
   ```

2. Start the services using Docker Compose:
   ```bash
   docker compose up -d
   ```

**Services Started:**
- **Keycloak** (Port `8081`): Available at `http://localhost:8081`
- **PostgreSQL Database** (Port `5433`): Used by Keycloak.

### Keycloak Pre-Configured Data (Auto-Import)

The Keycloak container is configured to automatically import the LIMS realm and its associated clients, users, and roles upon startup. 
The configuration files are located in the `keycloak-imports/` directory and are mounted into the container. 

You do not need to manually configure Keycloak or seed data. Simply run the `docker compose` command, and Keycloak will be ready to use by both the backend and frontend applications.

## Credentials
- Keycloak Admin Console:
  - Username: `admin`
  - Password: `admin`
- PostgreSQL Database:
  - Username: `keycloak`
  - Password: `keycloak`
  - Database: `keycloak`

## Useful Commands

- View logs for Keycloak:
  ```bash
  docker logs -f lims-keycloak
  ```

- Stop the services:
  ```bash
  docker compose down
  ```

- Completely wipe data and start fresh (this will delete the database contents, use with caution if testing updates):
  ```bash
  docker compose down -v
  docker compose up -d
  ```
