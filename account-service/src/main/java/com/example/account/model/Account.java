package com.example.account.model;

import javax.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.ThreadLocalRandom;

@Entity
@Table(name = "account", indexes = {
    @Index(name = "idx_account_user_id", columnList = "userId"),
    @Index(name = "idx_account_number", columnList = "accountNumber", unique = true)
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
@Setter
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String accountNumber;

    private String ownerName;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private AccountType accountType;

    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(nullable = false)
    private Long userId;

    @Version
    private Long version;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
        if (balance == null) {
            balance = BigDecimal.ZERO;
        }
        if (accountNumber == null) {
            accountNumber = generateAccountNumber();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    private String generateAccountNumber() {
        int year = java.time.Year.now().getValue();
        int random = ThreadLocalRandom.current().nextInt(100000, 999999);
        return String.format("PL-%d-%06d", year, random);
    }

    public enum AccountType {
        SAVINGS, CHECKING
    }
}
