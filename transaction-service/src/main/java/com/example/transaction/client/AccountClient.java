package com.example.transaction.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;

@Component
public class AccountClient {

    private final WebClient webClient;

    public AccountClient(WebClient.Builder webClientBuilder,
                         @Value("${account-service.url:http://localhost:8081}") String accountServiceUrl) {
        this.webClient = webClientBuilder.baseUrl(accountServiceUrl).build();
    }

    public Account getAccount(Long accountId, String jwtToken) {
        return webClient.get()
                .uri("/accounts/" + accountId)
                .header("Authorization", "Bearer " + jwtToken)
                .retrieve()
                .bodyToMono(Account.class)
                .block();
    }

    public Account getAccountByNumber(String accountNumber, String jwtToken) {
        try {
            return webClient.get()
                    .uri("/accounts/by-number/" + accountNumber)
                    .header("Authorization", "Bearer " + jwtToken)
                    .retrieve()
                    .bodyToMono(Account.class)
                    .block();
        } catch (Exception e) {
            return null;
        }
    }

    public void updateAccountBalance(Long accountId, BigDecimal newBalance, String jwtToken) {
        BalanceUpdateRequest request = new BalanceUpdateRequest();
        request.setNewBalance(newBalance);

        webClient.put()
                .uri("/accounts/" + accountId + "/balance")
                .header("Authorization", "Bearer " + jwtToken)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Account.class)
                .block();
    }

    // System-level balance update (for crediting transfer recipients)
    // Uses the same endpoint but with the JWT of the sending user
    // In production, this would use service-to-service auth
    public void updateAccountBalanceSystem(Long accountId, BigDecimal newBalance, String jwtToken) {
        BalanceUpdateRequest request = new BalanceUpdateRequest();
        request.setNewBalance(newBalance);

        webClient.put()
                .uri("/accounts/" + accountId + "/balance")
                .header("Authorization", "Bearer " + jwtToken)
                .header("X-System-Call", "true")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Account.class)
                .block();
    }

    public Account[] getAllAccounts(String jwtToken) {
        return webClient.get()
                .uri("/accounts")
                .header("Authorization", "Bearer " + jwtToken)
                .retrieve()
                .bodyToMono(Account[].class)
                .block();
    }

    public static class Account {
        private Long id;
        private String accountNumber;
        private String ownerName;
        private BigDecimal balance;
        private Long userId;
        private Long version;
        private String accountType;

        public Account() {}

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getAccountNumber() { return accountNumber; }
        public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
        public String getOwnerName() { return ownerName; }
        public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
        public BigDecimal getBalance() { return balance; }
        public void setBalance(BigDecimal balance) { this.balance = balance; }
        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public Long getVersion() { return version; }
        public void setVersion(Long version) { this.version = version; }
        public String getAccountType() { return accountType; }
        public void setAccountType(String accountType) { this.accountType = accountType; }
    }

    public static class BalanceUpdateRequest {
        private BigDecimal newBalance;
        public BigDecimal getNewBalance() { return newBalance; }
        public void setNewBalance(BigDecimal newBalance) { this.newBalance = newBalance; }
    }
}
