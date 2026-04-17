"""
VoiceAgent — WebSocket Manager
Manages per-call WebSocket connections for live transcript streaming.
"""

import asyncio
import json
from typing import Any, Callable, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}
        self._subscriptions: Dict[str, List[Callable[[dict], None]]] = {}

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
        """Broadcast to WebSocket clients and call subscriptions."""
        # Deliver to WebSocket clients
        dead: List[WebSocket] = []
        for ws in self._connections.get(call_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(call_id, ws)

        # Deliver to async callbacks (SSE, etc.)
        for cb in self._subscriptions.get(call_id, []):
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(data)
                else:
                    cb(data)
            except Exception:
                pass

        # Global monitor channel
        dead_monitor: List[WebSocket] = []
        for ws in self._connections.get("monitor", []):
            try:
                payload = data.copy()
                payload["callId"] = call_id
                await ws.send_json(payload)
            except Exception:
                dead_monitor.append(ws)
        for ws in dead_monitor:
            self.disconnect("monitor", ws)

    async def subscribe(self, call_id: str, callback: Callable[[dict], Any]) -> None:
        """Register a callback to receive all broadcast events for a call."""
        self._subscriptions.setdefault(call_id, []).append(callback)

    def unsubscribe(self, call_id: str, callback: Callable[[dict], Any]) -> None:
        """Remove a callback subscription."""
        subs = self._subscriptions.get(call_id, [])
        try:
            subs.remove(callback)
        except ValueError:
            pass
        if not subs:
            self._subscriptions.pop(call_id, None)


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
