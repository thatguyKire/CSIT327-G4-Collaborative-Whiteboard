import logging
from functools import wraps

from django.http import HttpResponse

logger = logging.getLogger(__name__)


def safe_view(func):
    """Log unhandled exceptions and swallow client disconnects (BrokenPipeError)."""
    @wraps(func)
    def wrapper(request, *args, **kwargs):
        try:
            return func(request, *args, **kwargs)
        except BrokenPipeError:
            logger.info("Client disconnected during view %s", func.__name__)
            return HttpResponse(status=204)
        except Exception:
            logger.exception("Unhandled exception in view %s", func.__name__)
            raise
    return wrapper
