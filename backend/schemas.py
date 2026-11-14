from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ==============================================================================
# ESQUEMAS: HABITACIÓN
# ==============================================================================
class HabitacionBase(BaseModel):
    numero: str = Field(..., description="Número visual de la habitación (ej: '101', '208')")
    piso: int = Field(1, ge=1, le=2, description="Piso 1 (101-107) o Piso 2 (201-208)")
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
# ESQUEMAS: HUÉSPED (Titular y Acompañantes)
# ==============================================================================
class HuespedBase(BaseModel):
    tipo_documento: str = Field("CC", description="'CC', 'CE', 'PA', 'NIT'")
    documento: str = Field(..., min_length=3, description="Número de identificación")
    nombres: str = Field(..., min_length=2)
    apellidos: str = Field(..., min_length=2)
    telefono: Optional[str] = None
    ciudad_procedencia: Optional[str] = None
    placa_vehiculo: Optional[str] = None


class HuespedResponse(HuespedBase):
    id: int
    fecha_registro: datetime

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
# ESQUEMAS: RESERVA / CHECK-IN
# ==============================================================================
class ReservaCreate(BaseModel):
    habitacion_id: int
    titular: HuespedBase
    acompanantes: List[HuespedBase] = []

    grupo_id: Optional[str] = None
    empresa: Optional[str] = None

    numero_personas: int = Field(1, gt=0)
    tarifa_descripcion: Optional[str] = None
    precio_noche: float = Field(..., gt=0)
    es_tarifa_manual: bool = False

    fecha_ingreso: datetime = Field(default_factory=datetime.now)
    fecha_salida: Optional[datetime] = None  # None/null para estadía abierta
    es_estadia_abierta: bool = False

    descuento_monto: float = Field(0.0, ge=0)
    descuento_porcentaje: float = Field(0.0, ge=0, le=100)
    recargo_adicional: float = Field(0.0, ge=0)
    observaciones_cobro: Optional[str] = None

    # Abono registrado directamente en el formulario de Check-in
    abono_inicial: float = Field(0.0, ge=0)
    metodo_pago_abono: str = "Efectivo"


class ReservaResponse(BaseModel):
    id: int
    habitacion_id: int
    titular: HuespedResponse
    acompanantes: List[HuespedResponse] = []

    grupo_id: Optional[str] = None
    empresa: Optional[str] = None

    numero_personas: int
    tarifa_descripcion: Optional[str] = None
    precio_noche: float
    es_tarifa_manual: bool

    fecha_ingreso: datetime
    fecha_salida: Optional[datetime] = None
    es_estadia_abierta: bool
    activa: bool

    descuento_monto: float
    descuento_porcentaje: float
    recargo_adicional: float
    observaciones_cobro: Optional[str] = None

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
    ciudad: Optional[str] = "Puerto Salgar"
    departamento: Optional[str] = "Cundinamarca"
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