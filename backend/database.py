from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# URL para la base de datos local SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///./mipueblo.db"

# Engine de SQLAlchemy con soporte para multihilo (requerido por SQLite en FastAPI)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Creador de sesiones para interactuar con la base de datos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Clase base de la que heredarán los modelos de las tablas
Base = declarative_base()


# Dependency para obtener la sesión en los endpoints de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()