from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Auth0
    auth0_domain: str
    auth0_audience: str
    auth0_role_claim: str = "https://eduvision/role"

    # OpenRouter / Gemini
    openrouter_api_key: str
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    gemini_model: str = "google/gemini-2.5-flash"
    gemini_audio_model: str = "google/gemini-2.5-flash"

    # ElevenLabs
    elevenlabs_api_key: str
    elevenlabs_default_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_aac_voice_id: str = "AZnzlk1XvdvUeBnXmlld"

    # Snowflake
    snowflake_account: str
    snowflake_user: str
    snowflake_password: str
    snowflake_database: str = "EDUVISION"
    snowflake_schema: str = "PUBLIC"
    snowflake_warehouse: str = "COMPUTE_WH"
    snowflake_role: str = "SYSADMIN"

    # DO Spaces
    do_spaces_key: str
    do_spaces_secret: str
    do_spaces_bucket: str = "eduvision-audio"
    do_spaces_endpoint: str = "https://nyc3.digitaloceanspaces.com"
    do_spaces_region: str = "nyc3"

    # App
    app_env: str = "development"
    app_secret_key: str = "change_me"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
