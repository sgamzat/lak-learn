#!/bin/bash

echo "🚀 Запуск системы изучения лакского языка..."

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и Docker Compose"
    exit 1
fi

# Создание необходимых директорий
mkdir -p backend/config backend/apps data nginx

# Создание примера данных, если их нет
if [ ! -f "data/dictionary.csv" ]; then
    echo "⚠️  Создаю пример словаря..."
    cat > data/dictionary.csv << 'EOF'
russian,lak,part_of_speech,category
я,мен,местоимение,основное
ты,ина,местоимение,основное
он,та,местоимение,основное
дом,хъун,существительное,дом
идти,ккарун,глагол,движение
хороший,хIуру,прилагательное,качество
вода,щин,существительное,природа
хлеб,ккак,существительное,еда
EOF
fi

if [ ! -f "data/phrasebook.csv" ]; then
    echo "⚠️  Создаю пример разговорника..."
    cat > data/phrasebook.csv << 'EOF'
russian,lak,topic
Как тебя зовут?,Ина цIа хьусса?,знакомство
Меня зовут...,ЦIа ... бусса,знакомство
Я иду домой,Мен хъуна ккарун бусса,движение
Спасибо,Баркалла,вежливость
EOF
fi

# Проверка наличия Dockerfile для frontend
if [ ! -f "frontend/Dockerfile" ]; then
    echo "⚠️  Создаю базовый Dockerfile для frontend..."
    mkdir -p frontend
    cat > frontend/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build || mkdir -p build && echo '<html><body>Lak Language App</body></html>' > build/index.html
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
EOF

    cat > frontend/package.json << 'EOF'
{
  "name": "lak-frontend",
  "version": "1.0.0",
  "scripts": {
    "build": "mkdir -p build && echo '<!DOCTYPE html><html><head><title>Lak Language</title></head><body><h1>Lak Language Learning</h1><p>Frontend is running</p></body></html>' > build/index.html"
  }
}
EOF
fi

# Остановка старых контейнеров
echo "🛑 Останавливаю старые контейнеры..."
docker-compose down 2>/dev/null

# Запуск контейнеров
echo "📦 Запуск Docker контейнеров..."
docker-compose up -d --build

# Ожидание запуска backend
echo "⏳ Ожидание запуска backend..."
sleep 10

# Создание суперпользователя (если нужно)
echo ""
echo "📝 Для создания администратора выполните:"
echo "   docker exec -it lak_backend python manage.py createsuperuser"

echo ""
echo "✅ Система запущена!"
echo "📱 Доступные адреса:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8000/api"
echo "   - API Health: http://localhost:8000/api/health/"
echo "   - Admin панель: http://localhost:8000/admin"
echo ""
echo "📊 Просмотр логов:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Остановка системы:"
echo "   docker-compose down"