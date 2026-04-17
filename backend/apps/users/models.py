# backend/apps/users/models.py

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta

class User(AbstractUser):
    """Расширенная модель пользователя"""
    
    # Базовая информация
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    native_language = models.CharField(max_length=10, default='ru')
    
    # Статистика обучения
    total_xp = models.IntegerField(default=0)
    streak_days = models.IntegerField(default=0)  # Дней подряд
    last_activity = models.DateTimeField(default=timezone.now)
    
    # Настройки
    daily_goal = models.IntegerField(default=10)  # XP в день
    
    # Для восстановления пароля
    reset_password_token = models.CharField(max_length=100, null=True, blank=True)
    reset_password_expires = models.DateTimeField(null=True, blank=True)
    
    def update_streak(self):
        """Обновление серии (стрика) при ежедневной активности"""
        today = timezone.now().date()
        last = self.last_activity.date()
        
        if last == today:
            return  # Уже обновлено сегодня
        elif last == today - timedelta(days=1):
            self.streak_days += 1
        else:
            self.streak_days = 1
        
        self.last_activity = timezone.now()
        self.save()
    
    def add_xp(self, amount):
        """Добавление опыта"""
        self.total_xp += amount
        self.save()
        
        # Обновляем уровень (level = floor(total_xp / 100) + 1)
        return (self.total_xp // 100) + 1


class UserProgress(models.Model):
    """Прогресс пользователя по урокам и словам"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='progress')
    
    # Прогресс по урокам
    lesson = models.ForeignKey('lessons.Lesson', on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Статистика прохождения
    attempts = models.IntegerField(default=0)  # Сколько раз пробовал
    best_score = models.IntegerField(default=0)  # Лучший процент
    last_score = models.IntegerField(default=0)
    
    # Время изучения
    time_spent = models.IntegerField(default=0)  # Секунд
    
    class Meta:
        unique_together = ['user', 'lesson']
        ordering = ['-completed_at']


class WordProgress(models.Model):
    """Статус изучения каждого слова для пользователя"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='word_progress')
    word = models.ForeignKey('vocabulary.Word', on_delete=models.CASCADE)
    
    # Состояние изучения
    status = models.CharField(max_length=20, choices=[
        ('new', 'Новое'),
        ('learning', 'Изучается'),
        ('review', 'На повторении'),
        ('mastered', 'Выучено'),
    ], default='new')
    
    # Статистика
    correct_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    
    # SRS (Spaced Repetition System)
    next_review = models.DateTimeField(default=timezone.now)
    ease_factor = models.FloatField(default=2.5)  # Коэффициент сложности
    
    def get_mastery_percentage(self):
        """Процент освоения слова"""
        total = self.correct_count + self.error_count
        if total == 0:
            return 0
        return (self.correct_count / total) * 100
    
    def record_answer(self, is_correct):
        """Запись ответа и обновление SRS"""
        if is_correct:
            self.correct_count += 1
        else:
            self.error_count += 1
        
        # Обновляем статус
        if self.get_mastery_percentage() >= 80 and self.correct_count >= 5:
            self.status = 'mastered'
        elif self.correct_count >= 3:
            self.status = 'review'
        elif self.correct_count > 0:
            self.status = 'learning'
        
        # SRS логика (упрощенный SM-2)
        if is_correct:
            if self.status == 'new':
                interval = 1  # 1 день
            elif self.status == 'learning':
                interval = 3  # 3 дня
            else:
                interval = int(self.ease_factor * 7)  # 7-14 дней
            
            self.next_review = timezone.now() + timedelta(days=interval)
        else:
            # При ошибке показываем раньше
            self.next_review = timezone.now() + timedelta(hours=6)
            self.ease_factor = max(1.3, self.ease_factor - 0.2)
        
        self.save()


class UserActivity(models.Model):
    """Лог активности пользователя (для аналитики)"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action_type = models.CharField(max_length=50)  # 'lesson_start', 'exercise_complete'
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]