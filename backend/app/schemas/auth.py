from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints
from typing_extensions import Annotated


Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class RegisterRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    email: EmailStr
    password: Password


class LoginRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    refresh_token: str = Field(min_length=32)


class TokenPairResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    token: str
    refresh_token: str


class TokenResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    token: str

