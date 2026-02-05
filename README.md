# PrimeLedger - Banking System

PrimeLedger is a microservices-based banking application dealing with user accounts, transactions, and secure authentication. It consists of multiple services working together to provide a robust ledger system.

## 🚀 Features

- **User Authentication & Security**
  - Secure User Registration & Login
  - **JWT Authorization** with Access (15 min) and Refresh (7 days) tokens
  - Token Revocation (Logout implementation)
  - Cross-user resource protection (Users can only access their own data)
  
- **Account Management**
  - Create secure bank accounts
  - View account details and balances
  - Single view of all user accounts

- **Transaction Processing**
  - **Deposit**: Add funds to accounts (Validated for positive amounts)
  - **Withdraw**: Remove funds (Validated for sufficient balance)
  - **History**: View transaction history filtered by user
  - **Event Driven**: Uses Apache Kafka for asynchronous transaction logging

## 🛠 Tech Stack

- **Java 1.8+**
- **Spring Boot 2.7.18**
- **Maven**
- **Apache Kafka** (for transaction events)
- **H2 / MySQL** (Database driven)
- **Spring Security** (OAuth2/JWT)

## 🏗 Microservices Architecture

| Service | Port | Description |
|---------|------|-------------|
| **Account Service** | `8081` | Handles Auth (Login/Register/Refresh) & Account management |
| **Transaction Service** | `8082` | Handles Deposits, Withdrawals, and Transaction History |
| **Notification Service**| `8083` | (Optional) Listens to Kafka events |

## 🏁 Getting Started

### Prerequisites
- Java 8 or higher
- Maven
- Apache Kafka (Running on localhost:9092)
- PostgreSQL (Running on localhost:5432)
  - Database: `banking`
  - User: `bankuser`
  - Password: `bankpass`

### Installation & Running

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd primeledger
   ```

2. **Build the Project**
   ```bash
   mvn clean install
   ```

3. **Start Account Service**
   Open a terminal:
   ```bash
   cd account-service
   mvn spring-boot:run
   ```
   *Service starts on port 8081*

4. **Start Transaction Service**
   Open a new terminal:
   ```bash
   cd transaction-service
   mvn spring-boot:run
   ```
   *Service starts on port 8082*

   *(Ensure Kafka is running locally if required by the configuration)*

## 🔐 OAuth2 & Authentication Flow

This project implements a **Stateless Authentication** mechanism using JWTs, closely mirroring OAuth2 patterns:

1.  **Login**: User sends credentials to `/auth/login`.
    -   Server validates credentials.
    -   Server issues an **Access Token** (Short-lived, e.g., 15 mins) and a **Refresh Token** (Long-lived, e.g., 7 days).
    
2.  **Access Protected Resources**:
    -   Client includes `Authorization: Bearer <ACCESS_TOKEN>` in HTTP headers.
    -   `JwtAuthenticationFilter` intercepts requests, validates the signature and expiration of the JWT.
    -   If valid, the request proceeds (e.g., to create a transaction).

3.  **Token Refresh**:
    -   When Access Token expires, Client sends the **Refresh Token** to `/auth/refresh`.
    -   Server verifies the Refresh Token in the database.
    -   If valid and not revoked, a **new Access Token** is issued.

4.  **Logout (Token Revocation)**:
    -   Client requests `/auth/logout`.
    -   Server marks the Refresh Token as **REVOKED** in the database.
    -   Future refresh attempts with this token will fail.
    
This approach ensures security (short access window) and user convenience (long session without frequent logins), with the ability to revoke sessions immediately via logout.

## 🧪 Testing with Postman

A complete Postman collection is included in the root directory: `test_postman.json`.

### Steps to Check Test Cases:

1.  **Open Postman**.
2.  **Import** the file `test_postman.json`.
3.  You will see a collection named **"PrimeLedger - Complete Test Suite (Phase 6)"**.
4.  **Run the Collection**:
    -   This suite is designed to run sequentially.
    -   It automatically handles:
        -   Registering users (Alice & Bob).
        -   Logging them in and **automatically saving tokens** to environment variables.
        -   Executing transactions.
        -   **Verifying Security**: Trying malicious actions (e.g., Alice accessing Bob's account) and asserting they fail (403 Forbidden).
        -   Testing Token Refresh and Logout flows.
5.  **Verify Results**:
    -   Green Checkmarks (✅) indicate passed tests.
    -   Check the "Test Results" tab for detailed assertions.
