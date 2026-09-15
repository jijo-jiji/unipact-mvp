from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle


class ScopedIPThrottle(SimpleRateThrottle):
    """
    Per-IP limit for sensitive, unauthenticated endpoints (login, registration, token refresh).
    Rates come from REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'][scope] and are read at request time,
    so they can be tuned with environment variables or overridden in tests.
    """

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES.get(self.scope)

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class LoginThrottle(ScopedIPThrottle):
    scope = 'login'


class RegisterThrottle(ScopedIPThrottle):
    scope = 'register'


class TokenRefreshThrottle(ScopedIPThrottle):
    scope = 'token_refresh'
