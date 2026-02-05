package com.example.account.scheduler;

import com.example.account.service.RefreshTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
public class TokenCleanupScheduler {

    @Autowired
    private RefreshTokenService refreshTokenService;

    /**
     * Clean up expired refresh tokens daily at 2 AM
     * Cron expression: second minute hour day month weekday
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void cleanupExpiredTokens() {
        System.out.println("Running scheduled cleanup of expired refresh tokens...");
        int deletedCount = refreshTokenService.deleteExpiredTokens();
        System.out.println("Expired refresh tokens cleanup completed. Deleted: " + deletedCount);
    }
}
