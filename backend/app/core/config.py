import os

class Settings:
    API_KEY = os.getenv("API_KEY", "nemo1234")

    POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres_user")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres_password")
    POSTGRES_SERVER = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB = os.getenv("POSTGRES_DB", "car_parking_db")

    @property
    def DATABASE_URL(self) -> str:
        # ใช้ค่าจาก POSTGRES_* เสมอ
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

settings = Settings()
print(f"Using Database URL: {settings.DATABASE_URL}")