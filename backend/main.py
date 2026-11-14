from datetime import datetime
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, engine, get_db

# Crear tablas en SQLite al arrancar si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API PMS - Hotel Mi Pueblo",
    version="2.0.0",
    description="Sistema de gestión hotelera con historial de huéspedes, liquidación automática y facturación",
)

# Configuración CORS para conexión con la interfaz gráfica / frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# MATRIZ TARIFARIA OFICIAL (Según climatización y ocupación)
# ==============================================================================
MATRIZ_TARIFAS = {
    "VENTILADOR": {
        "1_persona": 50000.0,
        "pareja": 65000.0,
        "2_personas_camas_separadas": 85000.0,
        "3_personas_doble_sencilla": 105000.0,
    },
    "AIRE": {
        "1_persona": 70000.0,
        "pareja": 95000.0,
        "2_personas_camas_separadas": 115000.0,
        "3_personas_doble_sencilla": 125000.0,
        "3_personas_camarote": 145000.0,
        "4_personas_camarote": 165000.0,
    },
}


def obtener_o_crear_huesped(
    db: Session, datos: schemas.HuespedBase
) -> models.Huesped:
    """Busca un huésped por documento; si existe actualiza sus datos, si no lo crea."""
    huesped = (
        db.query(models.Huesped)
        .filter(models.Huesped.documento == datos.documento.strip())
        .first()
    )
    if huesped:
        huesped.tipo_documento = datos.tipo_documento
        huesped.nombres = datos.nombres.strip()
        huesped.apellidos = datos.apellidos.strip()
        if datos.telefono:
            huesped.telefono = datos.telefono.strip()
        if datos.ciudad_procedencia:
            huesped.ciudad_procedencia = datos.ciudad_procedencia.strip()
        if datos.placa_vehiculo:
            huesped.placa_vehiculo = datos.placa_vehiculo.strip().upper()
    else:
        huesped = models.Huesped(
            tipo_documento=datos.tipo_documento,
            documento=datos.documento.strip(),
            nombres=datos.nombres.strip(),
            apellidos=datos.apellidos.strip(),
            telefono=datos.telefono.strip() if datos.telefono else None,
            ciudad_procedencia=(
                datos.ciudad_procedencia.strip()
                if datos.ciudad_procedencia
                else None
            ),
            placa_vehiculo=(
                datos.placa_vehiculo.strip().upper()
                if datos.placa_vehiculo
                else None
            ),
        )
        db.add(huesped)
        db.flush()
    return huesped


# ==============================================================================
# ENDPOINTS: HABITACIONES
# ==============================================================================
@app.get("/habitaciones", response_model=List[schemas.HabitacionResponse])
def listar_habitaciones(db: Session = Depends(get_db)):
    """Obtiene el mapa general de las 15 habitaciones (101-107 y 201-208) y su estado."""
    return (
        db.query(models.Habitacion)
        .order_by(models.Habitacion.numero.asc())
        .all()
    )


@app.get(
    "/habitaciones/{habitacion_id}", response_model=schemas.HabitacionResponse
)
def obtener_habitacion(habitacion_id: int, db: Session = Depends(get_db)):
    habitacion = (
        db.query(models.Habitacion)
        .filter(models.Habitacion.id == habitacion_id)
        .first()
    )
    if not habitacion:
        raise HTTPException(
            status_code=404, detail="Habitación no encontrada"
        )
    return habitacion


@app.patch("/habitaciones/{habitacion_id}/mantenimiento")
def cambiar_estado_mantenimiento(
    habitacion_id: int,
    observacion: str = "Mantenimiento general",
    db: Session = Depends(get_db),
):
    """Bloquea o libera una habitación para mantenimiento/reparaciones."""
    habitacion = (
        db.query(models.Habitacion)
        .filter(models.Habitacion.id == habitacion_id)
        .first()
    )
    if not habitacion:
        raise HTTPException(
            status_code=404, detail="Habitación no encontrada"
        )

    if habitacion.estado == "Ocupada":
        raise HTTPException(
            status_code=400,
            detail="No se puede poner en mantenimiento una habitación ocupada",
        )

    if habitacion.estado == "Mantenimiento":
        habitacion.estado = "Disponible"
        habitacion.observacion_estado = None
    else:
        habitacion.estado = "Mantenimiento"
        habitacion.observacion_estado = observacion

    db.commit()
    return {
        "mensaje": "Estado de habitación actualizado",
        "estado": habitacion.estado,
    }


# ==============================================================================
# ENDPOINTS: HUÉSPEDES (Historial y Búsqueda)
# ==============================================================================
@app.get("/huespedes/{documento}", response_model=schemas.HuespedResponse)
def buscar_huesped_por_documento(documento: str, db: Session = Depends(get_db)):
    """Busca un huésped en el historial para autocompletar el formulario de Check-in."""
    huesped = (
        db.query(models.Huesped)
        .filter(models.Huesped.documento == documento.strip())
        .first()
    )
    if not huesped:
        raise HTTPException(
            status_code=404, detail="Huésped no encontrado en el historial"
        )
    return huesped

@app.get("/huespedes", response_model=List[schemas.HuespedResponse])
def listar_todos_los_huespedes(db: Session = Depends(get_db)):
    """Lista el directorio histórico completo de huéspedes registrados en el hotel."""
    return (
        db.query(models.Huesped)
        .order_by(models.Huesped.fecha_registro.desc())
        .all()
    )


@app.get("/reservas/historial")
def listar_registro_llegadas(db: Session = Depends(get_db)):
    """Devuelve la bitácora cronológica de llegadas (activas e históricas) con hora exacta."""
    reservas = (
        db.query(models.Reserva)
        .order_by(models.Reserva.fecha_ingreso.desc())
        .all()
    )
    resultado = []
    for r in reservas:
        resultado.append({
            "id": r.id,
            "habitacion_numero": r.habitacion.numero,
            "fecha_ingreso": r.fecha_ingreso,
            "fecha_salida": r.fecha_salida,
            "es_estadia_abierta": r.es_estadia_abierta,
            "activa": r.activa,
            "empresa": r.empresa,
            "grupo_id": r.grupo_id,
            "numero_personas": r.numero_personas,
            "precio_noche": r.precio_noche,
            "titular": {
                "tipo_documento": r.titular.tipo_documento,
                "documento": r.titular.documento,
                "nombres": r.titular.nombres,
                "apellidos": r.titular.apellidos,
                "telefono": r.titular.telefono,
            },
            "acompanantes": [
                {
                    "tipo_documento": a.tipo_documento,
                    "documento": a.documento,
                    "nombres": a.nombres,
                    "apellidos": a.apellidos,
                    "telefono": a.telefono,
                }
                for a in r.acompanantes
            ],
        })
    return resultado


# ==============================================================================
# ENDPOINTS: RESERVAS / HOSPEDAJES (Check-in, Check-out, Liquidación)
# ==============================================================================
@app.post(
    "/reservas",
    response_model=schemas.ReservaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_reserva_checkin(
    reserva: schemas.ReservaCreate, db: Session = Depends(get_db)
):
    """Registra el Check-in de un huésped titular, acompañantes y abono inicial."""
    habitacion = (
        db.query(models.Habitacion)
        .filter(models.Habitacion.id == reserva.habitacion_id)
        .first()
    )
    if not habitacion:
        raise HTTPException(
            status_code=404, detail="Habitación no encontrada"
        )

    if habitacion.estado != "Disponible":
        raise HTTPException(
            status_code=400,
            detail=f"La habitación {habitacion.numero} no está disponible (Estado: {habitacion.estado})",
        )

    # 1. Crear o actualizar huésped titular y acompañantes
    titular = obtener_o_crear_huesped(db, reserva.titular)
    lista_acompanantes = [
        obtener_o_crear_huesped(db, acomp)
        for acomp in reserva.acompanantes
        if acomp.documento.strip()
    ]

    # 2. Crear instancia de la reserva
    nueva_reserva = models.Reserva(
        habitacion_id=reserva.habitacion_id,
        titular_id=titular.id,
        grupo_id=reserva.grupo_id,
        empresa=reserva.empresa,
        numero_personas=reserva.numero_personas,
        tarifa_descripcion=reserva.tarifa_descripcion,
        precio_noche=reserva.precio_noche,
        es_tarifa_manual=reserva.es_tarifa_manual,
        fecha_ingreso=reserva.fecha_ingreso,
        fecha_salida=None if reserva.es_estadia_abierta else reserva.fecha_salida,
        es_estadia_abierta=reserva.es_estadia_abierta,
        descuento_monto=reserva.descuento_monto,
        descuento_porcentaje=reserva.descuento_porcentaje,
        recargo_adicional=reserva.recargo_adicional,
        observaciones_cobro=reserva.observaciones_cobro,
        activa=True,
    )
    nueva_reserva.acompanantes = lista_acompanantes
    db.add(nueva_reserva)
    db.flush()

    # 3. Registrar abono inicial si se ingresó en el formulario
    if reserva.abono_inicial > 0:
        abono = models.Pago(
            reserva_id=nueva_reserva.id,
            monto=reserva.abono_inicial,
            metodo_pago=reserva.metodo_pago_abono,
            concepto="Abono inicial",
            observacion="Registrado durante el Check-in",
        )
        db.add(abono)

    # 4. Cambiar estado de la habitación a Ocupada
    habitacion.estado = "Ocupada"

    db.commit()
    db.refresh(nueva_reserva)
    return nueva_reserva


@app.get("/reservas/activas", response_model=List[schemas.ReservaResponse])
def listar_reservas_activas(db: Session = Depends(get_db)):
    """Lista los huéspedes alojados actualmente en el hotel."""
    return (
        db.query(models.Reserva).filter(models.Reserva.activa == True).all()
    )


@app.get("/reservas/{reserva_id}/liquidacion")
def obtener_liquidacion_reserva(
    reserva_id: int, db: Session = Depends(get_db)
):
    """Calcula el estado de cuenta exacto: Noches + Consumos - Descuentos - Abonos."""
    reserva = (
        db.query(models.Reserva)
        .filter(models.Reserva.id == reserva_id)
        .first()
    )
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    # 1. Calcular días hospedados (Mínimo 1 día)
    fecha_fin = (
        reserva.fecha_salida
        if (reserva.fecha_salida and not reserva.es_estadia_abierta)
        else datetime.now()
    )
    dias_estadia = (fecha_fin - reserva.fecha_ingreso).days
    dias_hospedados = max(1, dias_estadia)

    subtotal_noches = dias_hospedados * reserva.precio_noche

    # 2. Aplicar descuentos o recargos
    monto_descuento = reserva.descuento_monto
    if reserva.descuento_porcentaje > 0:
        monto_descuento += subtotal_noches * (
            reserva.descuento_porcentaje / 100.0
        )

    total_alojamiento = max(
        0.0, subtotal_noches - monto_descuento + reserva.recargo_adicional
    )

    # 3. Sumar consumos pendientes de tienda y lavandería
    consumos_pendientes = (
        db.query(models.Consumo)
        .filter(
            models.Consumo.reserva_id == reserva_id,
            models.Consumo.cargado_a_habitacion == True,
            models.Consumo.pagado == False,
            models.Consumo.es_cortesia == False,
        )
        .all()
    )

    total_consumos = sum(c.total for c in consumos_pendientes)

    # 4. Restar abonos / pagos realizados
    pagos_realizados = (
        db.query(models.Pago)
        .filter(models.Pago.reserva_id == reserva_id)
        .all()
    )
    total_abonado = sum(p.monto for p in pagos_realizados)

    # 5. Gran Total y Saldo Pendiente
    total_general = total_alojamiento + total_consumos
    saldo_pendiente = max(0.0, total_general - total_abonado)

    return {
        "reserva_id": reserva.id,
        "cliente": f"{reserva.titular.nombres} {reserva.titular.apellidos}",
        "documento": reserva.titular.documento,
        "empresa": reserva.empresa,
        "grupo_id": reserva.grupo_id,
        "habitacion_id": reserva.habitacion_id,
        "habitacion_numero": reserva.habitacion.numero,
        "dias_hospedados": dias_hospedados,
        "tarifa_noche": reserva.precio_noche,
        "subtotal_noches": subtotal_noches,
        "descuento_aplicado": monto_descuento,
        "recargo_adicional": reserva.recargo_adicional,
        "total_alojamiento": total_alojamiento,
        "total_consumos_tienda_lavanderia": total_consumos,
        "total_general": total_general,
        "total_abonado": total_abonado,
        "saldo_pendiente": saldo_pendiente,
    }


# ==============================================================================
# ENDPOINTS: ABONOS, PRODUCTOS Y CONSUMOS (Pagos parciales y Tienda/Lavandería)
# ==============================================================================
@app.post(
    "/pagos",
    response_model=schemas.PagoResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_abono(pago: schemas.PagoCreate, db: Session = Depends(get_db)):
    """Registra un pago parcial o abono a la reserva."""
    reserva = (
        db.query(models.Reserva)
        .filter(models.Reserva.id == pago.reserva_id)
        .first()
    )
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    nuevo_pago = models.Pago(**pago.model_dump())
    db.add(nuevo_pago)
    db.commit()
    db.refresh(nuevo_pago)
    return nuevo_pago


@app.get("/productos", response_model=List[schemas.ProductoServicioResponse])
def listar_productos(db: Session = Depends(get_db)):
    """Lista los productos de tienda y servicios de lavandería activos."""
    return (
        db.query(models.ProductoServicio)
        .filter(models.ProductoServicio.activo == True)
        .all()
    )


@app.post(
    "/productos",
    response_model=schemas.ProductoServicioResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_producto(
    producto: schemas.ProductoServicioCreate, db: Session = Depends(get_db)
):
    """Agrega un nuevo producto o servicio al catálogo."""
    nuevo = models.ProductoServicio(**producto.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.post(
    "/consumos",
    response_model=schemas.ConsumoResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_consumo(
    consumo: schemas.ConsumoCreate, db: Session = Depends(get_db)
):
    """Registra una compra de la tienda o servicio de lavandería a la cuenta."""
    item = (
        db.query(models.ProductoServicio)
        .filter(models.ProductoServicio.id == consumo.producto_servicio_id)
        .first()
    )
    if not item or not item.activo:
        raise HTTPException(
            status_code=404, detail="Producto o Servicio no disponible"
        )

    # Validar stock si es producto físico de tienda
    if item.tipo == "Producto" and item.stock < consumo.cantidad:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente para '{item.nombre}'. Disponibles: {item.stock}",
        )

    precio_unitario = item.precio_unitario
    total_calculado = (
        0.0 if consumo.es_cortesia else (precio_unitario * consumo.cantidad)
    )

    nuevo_consumo = models.Consumo(
        reserva_id=consumo.reserva_id,
        producto_servicio_id=consumo.producto_servicio_id,
        cantidad=consumo.cantidad,
        precio_unitario_aplicado=precio_unitario,
        total=total_calculado,
        cargado_a_habitacion=consumo.cargado_a_habitacion,
        pagado=consumo.pagado,
        es_cortesia=consumo.es_cortesia,
    )

    # Descontar del inventario si es un producto
    if item.tipo == "Producto":
        item.stock -= consumo.cantidad

    db.add(nuevo_consumo)
    db.commit()
    db.refresh(nuevo_consumo)
    return nuevo_consumo


# ==============================================================================
# ENDPOINTS: COMPROBANTES / FACTURAS ORDINARIAS
# ==============================================================================
@app.post(
    "/facturas",
    response_model=schemas.FacturaResponse,
    status_code=status.HTTP_201_CREATED,
)
def generar_comprobante_factura(
    factura_data: schemas.FacturaCreate, db: Session = Depends(get_db)
):
    """Genera el comprobante final de pago consolidando una o varias reservas."""
    reservas = (
        db.query(models.Reserva)
        .filter(models.Reserva.id.in_(factura_data.reserva_ids))
        .all()
    )
    if not reservas:
        raise HTTPException(
            status_code=404, detail="No se encontraron las reservas asociadas"
        )

    # Crear la factura/comprobante
    datos_factura = factura_data.model_dump()
    datos_factura.pop("reserva_ids")

    nueva_factura = models.Factura(**datos_factura)
    nueva_factura.reservas = reservas
    nueva_factura.estado_dian = "Emitida"

    # Marcar las reservas y habitaciones como finalizadas (Check-out)
    for reserva in reservas:
        reserva.activa = False
        if not reserva.fecha_salida:
            reserva.fecha_salida = datetime.now()

        # Liberar la habitación
        habitacion = (
            db.query(models.Habitacion)
            .filter(models.Habitacion.id == reserva.habitacion_id)
            .first()
        )
        if habitacion:
            habitacion.estado = "Disponible"

        # Marcar consumos como liquidados
        for consumo in reserva.consumos:
            consumo.pagado = True

    db.add(nueva_factura)
    db.commit()
    db.refresh(nueva_factura)
    return nueva_factura


# ==============================================================================
# ARCHIVOS ESTÁTICOS Y FRONTEND
# ==============================================================================
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/", include_in_schema=False)
def servir_frontend():
    return FileResponse("frontend/index.html")