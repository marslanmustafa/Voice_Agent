"""
VoiceAgent — WebSocket Manager
Manages per-call WebSocket connections for live transcript streaming.
"""

from typing import Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, call_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(call_id, []).append(ws)

    def disconnect(self, call_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(call_id, [])
        try:
            conns.remove(ws)
        except ValueError:
            pass
        if not conns:
            self._connections.pop(call_id, None)

    async def broadcast(self, call_id: str, data: dict) -> None:
        dead: List[WebSocket] = []
        for ws in self._connections.get(call_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(call_id, ws)


ws_manager = ConnectionManager()


@router.websocket("/ws/{call_id}")
async def ws_endpoint(websocket: WebSocket, call_id: str):
    """
    Frontend connects: new WebSocket(`${WS_URL}/ws/${call_id}`)
    Streams live transcript and call events.
    """
    await ws_manager.connect(call_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping
    except WebSocketDisconnect:
        ws_manager.disconnect(call_id, websocket)
