from datetime import datetime
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, engine, get_db

# Crear tablas en SQLite al arrancar si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API PMS - Hotel Mi Pueblo",
    version="1.0.0",
    description="Sistema de gestión hotelera con liquidación automática y soporte para facturación",
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


# ==============================================================================
# ENDPOINTS: HABITACIONES
# ==============================================================================
@app.get("/habitaciones", response_model=List[schemas.HabitacionResponse])
def listar_habitaciones(db: Session = Depends(get_db)):
    """Obtiene el mapa general de las 15 habitaciones y su estado actual."""
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
    habitacion_id: int, observacion: str, db: Session = Depends(get_db)
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
# ENDPOINTS: RESERVAS / HOSPEDAJES (Check-in, Check-out, Liquidación)
# ==============================================================================
@app.post(
    "/reservas",
    response_model=schemas.ReservaResponse,
    status_code=status.HTTP_21_CREATED,
)
def crear_reserva_checkin(
    reserva: schemas.ReservaCreate, db: Session = Depends(get_db)
):
    """Registra el Check-in de un huésped o grupo de trabajadores."""
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

    # Crear instancia de la reserva
    nueva_reserva = models.Reserva(**reserva.model_dump())
    nueva_reserva.activa = True

    # Cambiar estado de la habitación a Ocupada
    habitacion.estado = "Ocupada"

    db.add(nueva_reserva)
    db.commit()
    db.refresh(nueva_reserva)
    return nueva_reserva


@app.get(
    "/reservas/activas", response_model=List[schemas.ReservaResponse]
)
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
        reserva.fecha_salida if reserva.fecha_salida else datetime.now()
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
        "cliente": reserva.cliente_nombre,
        "habitacion_id": reserva.habitacion_id,
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
# ENDPOINTS: ABONOS Y CONSUMOS (Pagos parciales y Tienda/Lavandería)
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
    reserva_ids = datos_factura.pop("reserva_ids")

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