from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
)
from sqlalchemy.orm import relationship

from .database import Base

# ==============================================================================
# TABLA INTERMEDIA: FACTURAS Y RESERVAS (Facturación Unificada / Grupal)
# ==============================================================================
factura_reservas = Table(
    "factura_reservas",
    Base.metadata,
    Column("factura_id", Integer, ForeignKey("facturas.id"), primary_key=True),
    Column("reserva_id", Integer, ForeignKey("reservas.id"), primary_key=True),
)


# ==============================================================================
# TABLA 1: HABITACIONES (Inventario físico de las 15 habitaciones)
# ==============================================================================
class Habitacion(Base):
    __tablename__ = "habitaciones"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(
        String(10), unique=True, nullable=False, index=True
    )  # "01" a "15"
    tipo_camas = Column(
        String(100), nullable=False
    )  # "1 Cama Sencilla + 1 Doble" o "1 Camarote + 1 Doble"

    # Climatización
    tiene_ventilador = Column(Boolean, default=True, nullable=False)
    tiene_aire_acondicionado = Column(Boolean, default=False, nullable=False)

    # Estado visual y operativo de la habitación
    estado = Column(
        String(20), default="Disponible", nullable=False
    )  # "Disponible", "Ocupada", "Mantenimiento", "Limpieza"
    observacion_estado = Column(
        String(255), nullable=True
    )  # Ej: "Fuga en baño", "Pintando pared"

    # Relaciones
    reservas = relationship("Reserva", back_populates="habitacion")


# ==============================================================================
# TABLA 2: RESERVAS (Hospedajes, Trabajadores y Tarifas por Ocupación)
# ==============================================================================
class Reserva(Base):
    __tablename__ = "reservas"

    id = Column(Integer, primary_key=True, index=True)

    # Identificador para agrupar habitaciones de una misma empresa o contratista
    grupo_id = Column(String(50), nullable=True, index=True)

    cliente_nombre = Column(String(150), nullable=False)
    cliente_documento = Column(String(50), nullable=False)
    empresa = Column(String(150), nullable=True)

    # Control de tarifa por ocupación
    numero_personas = Column(Integer, default=1, nullable=False)
    precio_noche = Column(Float, nullable=False)

    # Fechas y estadías abiertas (trabajadores sin fecha fija de salida)
    fecha_ingreso = Column(DateTime, nullable=False, default=datetime.now)
    fecha_salida = Column(DateTime, nullable=True)  # None para salida abierta
    es_estadia_abierta = Column(Boolean, default=False, nullable=False)

    habitacion_id = Column(
        Integer, ForeignKey("habitaciones.id"), nullable=False
    )
    activa = Column(Boolean, default=True, nullable=False)

    # Descuentos y recargos (Late check-out, etc.)
    descuento_monto = Column(Float, default=0.0)
    descuento_porcentaje = Column(Float, default=0.0)
    recargo_adicional = Column(Float, default=0.0)  # Ej: Horas extra
    observaciones_cobro = Column(String(255), nullable=True)

    # Relaciones ORM
    habitacion = relationship("Habitacion", back_populates="reservas")
    consumos = relationship("Consumo", back_populates="reserva")
    pagos = relationship("Pago", back_populates="reserva")
    facturas = relationship(
        "Factura", secondary=factura_reservas, back_populates="reservas"
    )


# ==============================================================================
# TABLA 3: PAGOS / ABONOS (Registro de dinero recibido antes/durante la estadía)
# ==============================================================================
class Pago(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id"), nullable=False)

    monto = Column(Float, nullable=False)
    metodo_pago = Column(
        String(30), nullable=False
    )  # "Efectivo", "Nequi", "Transferencia", "Datafono"
    fecha_pago = Column(DateTime, default=datetime.now, nullable=False)
    concepto = Column(
        String(100), default="Abono a estadía"
    )  # "Abono inicial", "Pago parcial", "Liquidación final"
    observacion = Column(String(255), nullable=True)

    reserva = relationship("Reserva", back_populates="pagos")


# ==============================================================================
# TABLA 4: FACTURAS ORDINARIAS / COMPROBANTES DE PAGO
# ==============================================================================
class Factura(Base):
    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, index=True)

    tipo_cliente = Column(String(30), nullable=False, default="Persona Natural")

    # Datos del cliente / Empresa
    razon_social_o_nombre = Column(String(200), nullable=False)
    tipo_documento = Column(String(20), nullable=False)  # "CC", "NIT", "CE", etc.
    documento_numero = Column(String(50), nullable=False)
    dv = Column(String(5), nullable=True)

    direccion = Column(String(255), nullable=True, default="N/A")
    ciudad = Column(String(100), nullable=True, default="Local")
    departamento = Column(String(100), nullable=True, default="Local")
    correo_facturacion = Column(String(150), nullable=True)
    telefono = Column(String(30), nullable=True)
    responsabilidad_fiscal = Column(String(20), default="R-99-PN")

    # Totales
    subtotal = Column(Float, nullable=False)
    impuestos = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    total_pagado = Column(
        Float, default=0.0
    )  # Suma de abonos/pagos realizados
    saldo_pendiente = Column(Float, default=0.0)
    fecha_emision = Column(DateTime, default=datetime.now, nullable=False)

    # Control de envío
    enviado_correo = Column(Boolean, default=False)
    enviado_whatsapp = Column(Boolean, default=False)

    # Registro interno / DIAN futuro
    estado_dian = Column(String(20), default="Emitida")
    cufe = Column(String(255), nullable=True)

    reservas = relationship(
        "Reserva", secondary=factura_reservas, back_populates="facturas"
    )


# ==============================================================================
# TABLA 5: PRODUCTOS Y SERVICIOS (Tienda y Lavandería)
# ==============================================================================
class ProductoServicio(Base):
    __tablename__ = "productos_servicios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    tipo = Column(
        String(20), nullable=False
    )  # "Producto" (Tienda) o "Servicio" (Lavandería)
    precio_unitario = Column(Float, nullable=False)
    stock = Column(Integer, default=0)
    activo = Column(Boolean, default=True, nullable=False)

    consumos = relationship("Consumo", back_populates="producto_servicio")


# ==============================================================================
# TABLA 6: CONSUMOS (Cargos a la habitación / Cortesías)
# ==============================================================================
class Consumo(Base):
    __tablename__ = "consumos"

    id = Column(Integer, primary_key=True, index=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id"), nullable=False)
    producto_servicio_id = Column(
        Integer, ForeignKey("productos_servicios.id"), nullable=False
    )

    cantidad = Column(Integer, default=1, nullable=False)
    precio_unitario_aplicado = Column(Float, nullable=False)
    total = Column(Float, nullable=False)  # cantidad * precio_unitario_aplicado
    fecha_registro = Column(DateTime, default=datetime.now, nullable=False)

    cargado_a_habitacion = Column(Boolean, default=True, nullable=False)
    pagado = Column(Boolean, default=False, nullable=False)
    es_cortesia = Column(
        Boolean, default=False, nullable=False
    )  # True si es un obsequio o atencion del hotel

    reserva = relationship("Reserva", back_populates="consumos")
    producto_servicio = relationship(
        "ProductoServicio", back_populates="consumos"
    )