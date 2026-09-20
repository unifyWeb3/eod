"""Transport hardening for genlayer_py (flaky edge TLS).

- Spoofs a browser User-Agent (the stock genlayer-py UA correlates with
  frequent TLS/session failures on the Cloudflare edge; stdlib urllib
  with Mozilla UA is reliable).
- Retries transport-level failures; RPC-level errors (reverts etc.)
  propagate immediately.
No secrets here. Import before creating clients.
"""

import time

import requests

_orig_post = requests.post

_BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"


def _patched_post(url, *args, **kwargs):
    headers = dict(kwargs.get("headers") or {})
    headers["User-Agent"] = _BROWSER_UA
    kwargs["headers"] = headers
    return _orig_post(url, *args, **kwargs)


def apply(transport_retries=8, sleep_s=5):
    requests.post = _patched_post
    try:
        from genlayer_py.provider.provider import GenLayerProvider
        from genlayer_py.exceptions import GenLayerError

        _orig_make = GenLayerProvider.make_request

        def _retrying(self, method, params):
            last = None
            for _ in range(transport_retries):
                try:
                    return _orig_make(self, method, params)
                except GenLayerError as e:
                    msg = str(e)
                    if "failed:" in msg and ("failed (code=" not in msg):
                        last = e
                        time.sleep(sleep_s)
                        continue
                    raise
            raise last

        GenLayerProvider.make_request = _retrying
    except ImportError:
        pass
