from fastapi import APIRouter, Request

router = APIRouter()


@router.get(
    "/ping",
    tags=["Health Check"],
    description="Check service health and availability",
    response_description="pong",
)
def ping(request: Request) -> str:
    return "pong"
