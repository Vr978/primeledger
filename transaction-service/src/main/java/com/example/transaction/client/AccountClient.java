package com.example.transaction.client;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class AccountClient {

    protected final WebClient webClient;

    @Autowired
    public AccountClient(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl("http://localhost:8081").build();
    }

    // Get account by ID
    public Account getAccount(Long accountId, String jwtToken) {
        try {
            return webClient.get()
                    .uri("/accounts/" + accountId)
                    .header("Authorization", "Bearer " + jwtToken)
                    .retrieve()
                    .bodyToMono(Account.class)
                    .block();
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch account: " + e.getMessage());
        }
    }

    // Update account balance
    public void updateAccountBalance(Long accountId, Double newBalance, String jwtToken) {
        try {
            Account account = getAccount(accountId, jwtToken);
            account.setBalance(newBalance);

            webClient.put()
                    .uri("/accounts/" + accountId)
                    .header("Authorization", "Bearer " + jwtToken)
                    .bodyValue(account)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block();
        } catch (Exception e) {
            throw new RuntimeException("Failed to update account balance: " + e.getMessage());
        }
    }

    // Inner class to represent Account
    public static class Account {
        private Long id;
        private String ownerName;
        private Double balance;
        private Long userId;

        public Account() {
        }

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getOwnerName() {
            return ownerName;
        }

        public void setOwnerName(String ownerName) {
            this.ownerName = ownerName;
        }

        public Double getBalance() {
            return balance;
        }

        public void setBalance(Double balance) {
            this.balance = balance;
        }

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }
    }

    // Get all accounts for the authenticated user
    public Account[] getAllAccounts(String jwtToken) {
        try {
            return webClient.get()
                    .uri("/accounts")
                    .header("Authorization", "Bearer " + jwtToken)
                    .retrieve()
                    .bodyToMono(Account[].class)
                    .block();
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch accounts: " + e.getMessage());
        }
    }
}
