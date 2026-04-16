"""
VoiceAgent — Custom Exceptions
"""

from typing import Any


class VapiError(Exception):
    """Preserves actual Vapi status code and response body.

    When Vapi returns an error (4xx, 5xx), this exception stores
    the original status code and detail so routers can propagate
    the correct HTTP status instead of masking everything as 502.
    """

    def __init__(self, status_code: int, detail: Any):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Vapi error {status_code}: {detail}")