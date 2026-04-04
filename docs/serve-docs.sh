#!/bin/bash
# 📚 ByteCards Documentation Server
# Этот скрипт запускает локальный сервер для просмотра документации

echo "========================================"
echo "📚 ByteCards Documentation Server"
echo "========================================"
echo ""

# Определяем доступную команду
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null; then
    PYTHON=python
else
    echo "❌ Python не найден. Установите Python для запуска сервера."
    echo ""
    echo "Или откройте файлы документации напрямую:"
    echo "  - docs/index.html (главная страница)"
    echo "  - docs/swagger.html (Swagger UI)"
    echo "  - docs/diagrams.md (диаграммы)"
    exit 1
fi

echo "✅ Найден Python: $PYTHON"
echo ""
echo "🚀 Запуск сервера документации..."
echo ""
echo "📖 Главная страница: http://localhost:9000/index.html"
echo "🔌 Swagger UI:       http://localhost:9000/swagger.html"
echo "📄 OpenAPI Spec:     http://localhost:9000/openapi.yaml"
echo "🏗️ Диаграммы:        http://localhost:9000/diagrams.md"
echo ""
echo "Нажмите Ctrl+C для остановки сервера"
echo "========================================"
echo ""

cd "$(dirname "$0")"
$PYTHON -m http.server 9000
