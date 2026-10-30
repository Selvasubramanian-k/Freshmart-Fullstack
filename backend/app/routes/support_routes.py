"""Customer support / operations inbox (support team + FreshMart owner)."""
from fastapi import APIRouter, Depends, Query

from app.controllers import support_controller as support
from app.middleware.auth import require_support
from app.models.ticket import TicketActionIn

router = APIRouter(prefix="/api/support", tags=["Support"])


@router.get("/tickets")
async def tickets(show: str = Query("open", pattern="^(open|solved)$"), user: dict = Depends(require_support)):
    return await support.list_tickets(show)


@router.get("/tickets/{ticket_id}")
async def ticket(ticket_id: str, user: dict = Depends(require_support)):
    return await support.ticket_detail(ticket_id)


@router.post("/tickets/{ticket_id}/action")
async def act(ticket_id: str, data: TicketActionIn, user: dict = Depends(require_support)):
    return await support.act(user, ticket_id, data)
