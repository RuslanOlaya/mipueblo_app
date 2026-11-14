from .database import Base, SessionLocal, engine
from .models import Habitacion


def inicializar_base_datos():
    # Crear las tablas en la base de datos si no existen
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Si ya existen habitaciones en la base de datos, no duplicar la carga
    if db.query(Habitacion).count() > 0:
        print("La base de datos ya contiene habitaciones registradas.")
        db.close()
        return

    habitaciones_iniciales = []

    # Habitaciones 01 a 03: 1 Sencilla + 1 Doble | SOLO VENTILADOR
    for i in range(1, 4):
        habitaciones_iniciales.append(
            Habitacion(
                numero=f"{i:02d}",
                tipo_camas="1 Cama Sencilla + 1 Cama Doble",
                tiene_ventilador=True,
                tiene_aire_acondicionado=False,
                estado="Disponible",
            )
        )

    # Habitación 04: 1 Sencilla + 1 Doble | MIXTA (Ventilador + Aire)
    habitaciones_iniciales.append(
        Habitacion(
            numero="04",
            tipo_camas="1 Cama Sencilla + 1 Cama Doble",
            tiene_ventilador=True,
            tiene_aire_acondicionado=True,
            estado="Disponible",
        )
    )

    # Habitaciones 05 a 13 (9 habs): 1 Sencilla + 1 Doble | SOLO AIRE
    for i in range(5, 14):
        habitaciones_iniciales.append(
            Habitacion(
                numero=f"{i:02d}",
                tipo_camas="1 Cama Sencilla + 1 Cama Doble",
                tiene_ventilador=False,
                tiene_aire_acondicionado=True,
                estado="Disponible",
            )
        )

    # Habitaciones 14 y 15 (2 habs): 1 Camarote + 1 Doble | SOLO AIRE
    for i in range(14, 16):
        habitaciones_iniciales.append(
            Habitacion(
                numero=f"{i:02d}",
                tipo_camas="1 Camarote + 1 Cama Doble",
                tiene_ventilador=False,
                tiene_aire_acondicionado=True,
                estado="Disponible",
            )
        )

    db.add_all(habitaciones_iniciales)
    db.commit()
    db.close()
    print("¡Base de datos cargada correctamente con las 15 habitaciones!")


if __name__ == "__main__":
    inicializar_base_datos()