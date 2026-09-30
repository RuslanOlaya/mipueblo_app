from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ==============================================================================
# ESQUEMAS: HABITACIÓN
# ==============================================================================
class HabitacionBase(BaseModel):
    numero: str = Field(..., description="Número visual de la habitación (ej: '01', '15')")
    tipo_camas: str = Field(..., description="Distribución de camas")
    tiene_ventilador: bool = True
    tiene_aire_acondicionado: bool = False
    estado: str = Field("Disponible", description="'Disponible', 'Ocupada', 'Mantenimiento', 'Limpieza'")
    observacion_estado: Optional[str] = None


class HabitacionCreate(HabitacionBase):
    pass


class HabitacionResponse(HabitacionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# ESQUEMAS: PRODUCTO / SERVICIO (Catálogo)
# ==============================================================================
class ProductoServicioBase(BaseModel):
    nombre: str
    tipo: str = Field(..., description="'Producto' (Tienda) o 'Servicio' (Lavandería)")
    precio_unitario: float = Field(..., gt=0)
    stock: int = Field(0, ge=0)
    activo: bool = True


class ProductoServicioCreate(ProductoServicioBase):
    pass


class ProductoServicioResponse(ProductoServicioBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# ESQUEMAS: CONSUMO (Cargos a la habitación)
# ==============================================================================
class ConsumoCreate(BaseModel):
    reserva_id: int
    producto_servicio_id: int
    cantidad: int = Field(1, gt=0)
    cargado_a_habitacion: bool = True
    pagado: bool = False
    es_cortesia: bool = False


class ConsumoResponse(BaseModel):
    id: int
    reserva_id: int
    producto_servicio_id: int
    cantidad: int
    precio_unitario_aplicado: float
    total: float
    fecha_registro: datetime
    cargado_a_habitacion: bool
    pagado: bool
    es_cortesia: bool

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# ESQUEMAS: PAGO / ABONO
# ==============================================================================
class PagoCreate(BaseModel):
    reserva_id: int
    monto: float = Field(..., gt=0)
    metodo_pago: str = Field(..., description="'Efectivo', 'Nequi', 'Transferencia', 'Datafono'")
    concepto: Optional[str] = "Abono a estadía"
    observacion: Optional[str] = None


class PagoResponse(PagoCreate):
    id: int
    fecha_pago: datetime

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# ESQUEMAS: RESERVA
# ==============================================================================
class ReservaBase(BaseModel):
    grupo_id: Optional[str] = None
    cliente_nombre: str
    cliente_documento: str
    empresa: Optional[str] = None
    numero_personas: int = Field(1, gt=0)
    precio_noche: float = Field(..., gt=0)
    fecha_ingreso: datetime = Field(default_factory=datetime.now)
    fecha_salida: Optional[datetime] = None  # None/null para estadía abierta
    es_estadia_abierta: bool = False
    habitacion_id: int
    descuento_monto: float = 0.0
    descuento_porcentaje: float = 0.0
    recargo_adicional: float = 0.0
    observaciones_cobro: Optional[str] = None


class ReservaCreate(ReservaBase):
    pass


class ReservaResponse(ReservaBase):
    id: int
    activa: bool

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# ESQUEMAS: FACTURA / COMPROBANTE DE PAGO
# ==============================================================================
class FacturaCreate(BaseModel):
    reserva_ids: List[int] = Field(..., min_length=1, description="IDs de las reservas a consolidar")
    tipo_cliente: str = Field("Persona Natural", description="'Persona Natural' o 'Empresa'")
    razon_social_o_nombre: str
    tipo_documento: str = Field(..., description="'CC', 'NIT', 'CE', 'Pasaporte'")
    documento_numero: str
    dv: Optional[str] = None
    direccion: Optional[str] = "N/A"
    ciudad: Optional[str] = "Local"
    departamento: Optional[str] = "Local"
    correo_facturacion: Optional[EmailStr] = None
    telefono: Optional[str] = None
    responsabilidad_fiscal: str = "R-99-PN"
    subtotal: float
    impuestos: float = 0.0
    total: float
    total_pagado: float = 0.0
    saldo_pendiente: float = 0.0


class FacturaResponse(BaseModel):
    id: int
    tipo_cliente: str
    razon_social_o_nombre: str
    tipo_documento: str
    documento_numero: str
    dv: Optional[str]
    correo_facturacion: Optional[str]
    subtotal: float
    impuestos: float
    total: float
    total_pagado: float
    saldo_pendiente: float
    fecha_emision: datetime
    enviado_correo: bool
    enviado_whatsapp: bool
    estado_dian: str
    cufe: Optional[str]

    model_config = ConfigDict(from_attributes=True)