# backend/apps/learning/middleware.py

from django.utils import timezone
from ..users.models import UserActivity

class LearningActivityMiddleware:
    """Отслеживание активности пользователя"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Если пользователь аутентифицирован и это API запрос к обучению
        if request.user.is_authenticated and '/api/learning/' in request.path:
            # Логируем активность
            UserActivity.objects.create(
                user=request.user,
                action_type='page_view',
                metadata={'path': request.path, 'method': request.method}
            )
        
        return response