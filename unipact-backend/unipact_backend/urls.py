from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import path, include


def health(request):
    """Used by the hosting platform to check the app is up and can reach the database."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        return JsonResponse({'status': 'ok'})
    except Exception:
        return JsonResponse({'status': 'database_unavailable'}, status=503)


urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path('api/health/', health, name='health'),
    path('api/users/', include('users.urls')),
    path('api/campaigns/', include('campaigns.urls')),
    path('api/payments/', include('payments.urls')),
]

# Serve uploaded files (deliverables, client assets, reports) during development only.
# In production they are served from object storage (USE_S3=true).
if settings.DEBUG and not settings.USE_S3:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
