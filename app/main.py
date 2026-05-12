from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.qrm import Session

from . import models, schemas
from .database import SessionLocal, engine, get_db
from .ml import calculate_loan_risk

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DLHB Core",
    description="API inicial para la gestión de préstamos de capital.",
    version="0.1.0",
)


@app.post("/clients/", response_model=schemas.ClientRead)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)) -> schemas.ClientRead:
    """Crea un cliente nuevo."""
    db_client = models.Client(name=client.name, phone=client.phone)
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


@app.get("/clients/{client_id}", response_model=schemas.ClientRead)
def read_client(client_id: int, db: Session = Depends(get_db)) -> schemas.ClientRead:
    """Recupera los datos de un cliente por su ID."""
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@app.post("/loans/", response_model=schemas.LoanRead)
def create_loan(loan: schemas.LoanCreate, db: Session = Depends(get_db)) -> schemas.LoanRead:
    """Registra un nuevo préstamo para un cliente existente."""
    client = db.query(models.Client).filter(models.Client.id == loan.client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    db_loan = models.Loan(
        client_id=loan.client_id,
        initial_capital=loan.initial_capital,
        interest_rate=loan.interest_rate,
        modality_days=loan.modality_days,
        outstanding_balance=loan.outstanding_balance,
        status=loan.status,
        advisor=loan.advisor,
        delivery_date=loan.delivery_date,
        due_date=loan.due_date,
    )
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan


@app.get("/loans/{loan_id}", response_model=schemas.LoanRead)
def read_loan(loan_id: int, db: Session = Depends(get_db)) -> schemas.LoanRead:
    """Recupera un préstamo por su ID."""
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if loan is None:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    return loan


@app.post("/payments/", response_model=schemas.PaymentRead)
def create_payment(payment: schemas.PaymentCreate, db: Session = Depends(get_db)) -> schemas.PaymentRead:
    """Registra un pago asociado a un préstamo."""
    loan = db.query(models.Loan).filter(models.Loan.id == payment.loan_id).first()
    if loan is None:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    db_payment = models.Payment(
        loan_id=payment.loan_id,
        payment_date=payment.payment_date,
        amount_received=payment.amount_received,
        principal_payment=payment.principal_payment,
        interest_payment=payment.interest_payment,
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


@app.get("/payments/{payment_id}", response_model=schemas.PaymentRead)
def read_payment(payment_id: int, db: Session = Depends(get_db)) -> schemas.PaymentRead:
    """Recupera un pago por su ID."""
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if payment is None:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return payment


@app.post("/pagos/registrar", response_model=schemas.PaymentRead, status_code=status.HTTP_201_CREATED)
def register_payment(
    payment_request: schemas.PaymentRegister,
    db: Session = Depends(get_db),
) -> schemas.PaymentRead:
    """
    Registra un pago con lógica transaccional.

    Realiza las siguientes operaciones atómicamente:
    1. Calcula el abono de interés y capital basado en la tasa del préstamo.
    2. Resta el abono de capital del saldo pendiente.
    3. Si el saldo llega a 0, cambia el estado del préstamo a INACTIVO.
    4. Registra el pago en la base de datos.

    En caso de error, realiza rollback automático.
    """
    try:
        # 1. Validar que el préstamo existe
        loan = db.query(models.Loan).filter(models.Loan.id == payment_request.loan_id).first()
        if loan is None:
            raise HTTPException(status_code=404, detail="Préstamo no encontrado")

        # 2. Validar que el préstamo esté ACTIVO
        if loan.status == models.LoanStatus.INACTIVO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede registrar pagos para un préstamo INACTIVO",
            )

        # 3. Validar que el monto recibido no sea mayor al saldo pendiente
        if payment_request.amount_received > loan.outstanding_balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El monto recibido ({payment_request.amount_received}) "
                f"no puede ser mayor al saldo pendiente ({loan.outstanding_balance})",
            )

        # 4. Calcular interés y capital basado en la tasa del préstamo
        # Interés pendiente = saldo_pendiente * tasa_interés
        interest_pending = loan.outstanding_balance * loan.interest_rate

        # Distribución del pago: primero interés, luego capital
        if payment_request.amount_received >= interest_pending:
            interest_payment = interest_pending
            principal_payment = payment_request.amount_received - interest_payment
        else:
            # Si el monto no cubre el interés, todo va a interés
            interest_payment = payment_request.amount_received
            principal_payment = 0.0

        # 5. Actualizar el saldo pendiente (restar el abono de capital)
        loan.outstanding_balance -= principal_payment

        # 6. Si el saldo llega a 0 o menos, cambiar estado a INACTIVO
        if loan.outstanding_balance <= 0.0:
            loan.outstanding_balance = 0.0
            loan.status = models.LoanStatus.INACTIVO

        # 7. Crear el registro de pago
        db_payment = models.Payment(
            loan_id=payment_request.loan_id,
            payment_date=payment_request.payment_date,
            amount_received=payment_request.amount_received,
            principal_payment=principal_payment,
            interest_payment=interest_payment,
        )

        # 8. Agregar y confirmar la transacción
        db.add(db_payment)
        db.flush()  # Flush para validar restricciones antes del commit

        db.commit()
        db.refresh(db_payment)

        return db_payment

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en la transacción de base de datos: {str(e)}",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado: {str(e)}",
        )


@app.post("/riesgo/evaluar", response_model=schemas.RiskAssessmentResponse)
def assess_loan_risk(
    request: schemas.RiskAssessmentRequest,
) -> schemas.RiskAssessmentResponse:
    """
    Evalúa el riesgo de mora de un préstamo propuesto.

    Utiliza un modelo entrenado con Random Forest para predecir la probabilidad
    de que el préstamo entre en mora basado en:
    - Modalidad en días (10, 15, 25, 31)
    - Tasa de interés (0.15 a 0.25)
    - Historial de pagos a tiempo del cliente (0.0 a 1.0)

    Retorna:
    - Probabilidad de mora (0.0 a 1.0)
    - Nivel de riesgo: BAJO (<33%), MEDIO (33-66%), ALTO (>66%)
    - Score de riesgo (0-100)
    - Recomendación de aprobación
    """
    try:
        result = calculate_loan_risk(
            modality_days=request.modality_days,
            interest_rate=request.interest_rate,
            client_payment_history_score=request.client_payment_history_score,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al evaluar riesgo: {str(e)}",
        )
