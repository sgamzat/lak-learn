# backend/config/urls.py

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok', 'message': 'Lak Language API is running'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check),
    path('api/', include('rest_framework.urls')),
]