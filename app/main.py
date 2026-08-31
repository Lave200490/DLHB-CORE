from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
import csv
import io

from . import models, schemas
from .database import SessionLocal, engine, get_db
from .ml import calculate_loan_risk

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DLHB Core",
    description="API para la gestión de préstamos de capital.",
    version="0.1.0",
)

# CORS: permite peticiones desde el frontend en desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Clientes
# ---------------------------------------------------------------------------

@app.get("/clients/", response_model=list[schemas.ClientRead])
def list_clients(db: Session = Depends(get_db)) -> list[schemas.ClientRead]:
    """Retorna todos los clientes registrados."""
    return db.query(models.Client).order_by(models.Client.id).all()


@app.post("/clients/", response_model=schemas.ClientRead, status_code=status.HTTP_201_CREATED)
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


@app.patch("/clients/{client_id}", response_model=schemas.ClientRead)
def update_client(
    client_id: int,
    data: schemas.ClientUpdate,
    db: Session = Depends(get_db),
) -> schemas.ClientRead:
    """Actualiza nombre y/o teléfono de un cliente."""
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if data.name is not None:
        client.name = data.name
    if data.phone is not None:
        client.phone = data.phone
    db.commit()
    db.refresh(client)
    return client


@app.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db)) -> None:
    """Elimina un cliente y sus préstamos/pagos en cascada."""
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(client)
    db.commit()


# ---------------------------------------------------------------------------
# Préstamos
# ---------------------------------------------------------------------------

@app.get("/loans/", response_model=list[schemas.LoanRead])
def list_loans(db: Session = Depends(get_db)) -> list[schemas.LoanRead]:
    """Retorna todos los préstamos registrados."""
    return db.query(models.Loan).order_by(models.Loan.id).all()


@app.post("/loans/", response_model=schemas.LoanRead, status_code=status.HTTP_201_CREATED)
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


@app.patch("/loans/{loan_id}", response_model=schemas.LoanRead)
def update_loan(
    loan_id: int,
    data: schemas.LoanUpdate,
    db: Session = Depends(get_db),
) -> schemas.LoanRead:
    """Actualiza estado, saldo o fecha de vencimiento de un préstamo."""
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if loan is None:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    if data.status is not None:
        loan.status = data.status
    if data.outstanding_balance is not None:
        loan.outstanding_balance = data.outstanding_balance
    if data.due_date is not None:
        loan.due_date = data.due_date
    db.commit()
    db.refresh(loan)
    return loan


@app.delete("/loans/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(loan_id: int, db: Session = Depends(get_db)) -> None:
    """Elimina un préstamo y sus pagos en cascada."""
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if loan is None:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    db.delete(loan)
    db.commit()


# ---------------------------------------------------------------------------
# Pagos
# ---------------------------------------------------------------------------

@app.get("/payments/", response_model=list[schemas.PaymentRead])
def list_payments(loan_id: int | None = None, db: Session = Depends(get_db)) -> list[schemas.PaymentRead]:
    """Retorna pagos. Si se pasa loan_id, filtra por préstamo."""
    query = db.query(models.Payment)
    if loan_id is not None:
        query = query.filter(models.Payment.loan_id == loan_id)
    return query.order_by(models.Payment.id).all()


@app.post("/payments/", response_model=schemas.PaymentRead, status_code=status.HTTP_201_CREATED)
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
        loan = db.query(models.Loan).filter(models.Loan.id == payment_request.loan_id).first()
        if loan is None:
            raise HTTPException(status_code=404, detail="Préstamo no encontrado")

        if loan.status == models.LoanStatus.INACTIVO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede registrar pagos para un préstamo INACTIVO",
            )

        interest_pending = loan.outstanding_balance * loan.interest_rate
        max_payment = loan.outstanding_balance + interest_pending

        if payment_request.amount_received > max_payment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El monto recibido ({payment_request.amount_received:.2f}) "
                f"no puede ser mayor al total adeudado "
                f"(saldo {loan.outstanding_balance:.2f} + interés {interest_pending:.2f} = {max_payment:.2f})",
            )

        if payment_request.amount_received >= interest_pending:
            interest_payment = interest_pending
            principal_payment = payment_request.amount_received - interest_payment
        else:
            interest_payment = payment_request.amount_received
            principal_payment = 0.0

        loan.outstanding_balance -= principal_payment

        if loan.outstanding_balance <= 0.0:
            loan.outstanding_balance = 0.0
            loan.status = models.LoanStatus.INACTIVO

        db_payment = models.Payment(
            loan_id=payment_request.loan_id,
            payment_date=payment_request.payment_date,
            amount_received=payment_request.amount_received,
            principal_payment=principal_payment,
            interest_payment=interest_payment,
        )

        db.add(db_payment)
        db.flush()
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


# ---------------------------------------------------------------------------
# Exportación CSV
# ---------------------------------------------------------------------------

@app.get("/export/loans")
def export_loans_csv(db: Session = Depends(get_db)):
    """Exporta todos los préstamos como CSV."""
    loans = db.query(models.Loan).order_by(models.Loan.id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "client_id", "initial_capital", "interest_rate",
        "modality_days", "outstanding_balance", "status",
        "advisor", "delivery_date", "due_date",
    ])
    for loan in loans:
        writer.writerow([
            loan.id, loan.client_id, loan.initial_capital, loan.interest_rate,
            loan.modality_days, loan.outstanding_balance, loan.status.value,
            loan.advisor, loan.delivery_date, loan.due_date,
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=prestamos.csv"},
    )


@app.get("/export/payments")
def export_payments_csv(db: Session = Depends(get_db)):
    """Exporta todos los pagos como CSV."""
    payments = db.query(models.Payment).order_by(models.Payment.id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "loan_id", "payment_date",
        "amount_received", "principal_payment", "interest_payment",
    ])
    for p in payments:
        writer.writerow([
            p.id, p.loan_id, p.payment_date,
            p.amount_received, p.principal_payment, p.interest_payment,
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pagos.csv"},
    )


# ---------------------------------------------------------------------------
# Riesgo (IA)
# ---------------------------------------------------------------------------

@app.post("/riesgo/evaluar", response_model=schemas.RiskAssessmentResponse)
def assess_loan_risk(
    request: schemas.RiskAssessmentRequest,
) -> schemas.RiskAssessmentResponse:
    """
    Evalúa el riesgo de mora de un préstamo propuesto usando Random Forest.
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
