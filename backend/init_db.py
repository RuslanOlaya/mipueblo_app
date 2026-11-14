from .database import Base, SessionLocal, engine
from .models import Habitacion, ProductoServicio


def inicializar_base_datos():
    # Crear las tablas en la base de datos si no existen
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Si ya existen habitaciones en la base de datos, no duplicar la carga
    if db.query(Habitacion).count() > 0:
        print("La base de datos ya contiene habitaciones registradas.")
        db.close()
        return

    habitaciones_iniciales = [
        # PISO 1: Habitaciones 101 a 107
        Habitacion(
            numero="101",
            piso=1,
            tipo_camas="1 Cama Sencilla + 1 Cama Doble",
            tiene_ventilador=True,
            tiene_aire_acondicionado=False,
            estado="Disponible",
        ),
        Habitacion(
            numero="102",
            piso=1,
            tipo_camas="1 Cama Sencilla + 1 Cama Doble",
            tiene_ventilador=True,
            tiene_aire_acondicionado=False,
            estado="Disponible",
        ),
        Habitacion(
            numero="103",
            piso=1,
            tipo_camas="1 Cama Sencilla + 1 Cama Doble",
            tiene_ventilador=True,
            tiene_aire_acondicionado=True,
            estado="Disponible",
        ),
        Habitacion(
            numero="104",
            piso=1,
            tipo_camas="1 Cama Sencilla + 1 Cama Doble",
            tiene_ventilador=True,
            tiene_aire_acondicionado=False,
            estado="Disponible",
        ),
        Habitacion(
            numero="105",
            piso=1,
            tipo_camas="1 Cama Sencilla + 1 Cama Doble",
            tiene_ventilador=False,
            tiene_aire_acondicionado=True,
            estado="Disponible",
        ),
        Habitacion(
            numero="106",
            piso=1,
            tipo_camas="1 Camarote + 1 Cama Doble",
            tiene_ventilador=False,
            tiene_aire_acondicionado=True,
            estado="Disponible",
        ),
        Habitacion(
            numero="107",
            piso=1,
            tipo_camas="1 Camarote + 1 Cama Doble",
            tiene_ventilador=False,
            tiene_aire_acondicionado=True,
            estado="Disponible",
        ),
    ]

    # PISO 2: Habitaciones 201 a 208 (8 habitaciones con Aire Acondicionado)
    for num in range(201, 209):
        habitaciones_iniciales.append(
            Habitacion(
                numero=str(num),
                piso=2,
                tipo_camas="1 Cama Sencilla + 1 Cama Doble",
                tiene_ventilador=False,
                tiene_aire_acondicionado=True,
                estado="Disponible",
            )
        )

    # Catálogo inicial de Tienda y Lavandería
    catalogo_inicial = [
        ProductoServicio(
            nombre="Botella de Agua 600ml",
            tipo="Producto",
            precio_unitario=3000.0,
            stock=40,
            activo=True,
        ),
        ProductoServicio(
            nombre="Gaseosa Personal 400ml",
            tipo="Producto",
            precio_unitario=4000.0,
            stock=30,
            activo=True,
        ),
        ProductoServicio(
            nombre="Cerveza Nacional Lata",
            tipo="Producto",
            precio_unitario=5000.0,
            stock=48,
            activo=True,
        ),
        ProductoServicio(
            nombre="Servicio de Lavandería (Carga)",
            tipo="Servicio",
            precio_unitario=15000.0,
            stock=0,
            activo=True,
        ),
    ]

    db.add_all(habitaciones_iniciales)
    db.add_all(catalogo_inicial)
    db.commit()
    db.close()
    print(
        "¡Base de datos cargada correctamente con las 15 habitaciones (101-107 y 201-208) y catálogo base!"
    )


if __name__ == "__main__":
    inicializar_base_datos()