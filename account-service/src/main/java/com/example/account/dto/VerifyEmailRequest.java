package com.example.account.dto;

import javax.validation.constraints.NotBlank;

public class VerifyEmailRequest {

    @NotBlank(message = "Verification code is required")
    private String code;

    public VerifyEmailRequest() {}

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
}
