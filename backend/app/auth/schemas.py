"""
auth/schemas.py - Pydantic models for auth endpoints.
"""
import re
from typing import Optional
from pydantic import BaseModel, field_validator


EMAIL_RE = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError('Invalid email address')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Name is required')
        if len(v) > 100:
            raise ValueError('Name is too long')
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class RefreshRequest(BaseModel):
    refresh_token: str


class SendMobileOtpRequest(BaseModel):
    phone: str
    name: Optional[str] = None

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r'[\s\-\(\)]', '', v.strip())
        if len(cleaned) < 8 or not re.match(r'^\+?[0-9]{8,15}$', cleaned):
            raise ValueError('Please enter a valid mobile number with country code (e.g. +91 9876543210)')
        return cleaned


class VerifyMobileOtpRequest(BaseModel):
    phone: str
    code: str
    name: Optional[str] = "Friend"

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r'[\s\-\(\)]', '', v.strip())
        return cleaned

    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) != 6 or not cleaned.isdigit():
            raise ValueError('OTP must be a 6-digit number')
        return cleaned


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = None


class AuthUserOut(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = None

