.PHONY: build up down logs clean

# Set Java 17 for compilation
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home

build:
	mvn clean package -DskipTests -q
	@echo "✅ All JARs built successfully"

up: build
	docker compose up --build -d
	@echo "✅ All services starting... Run 'make logs' to watch"

down:
	docker compose down -v
	@echo "✅ All services stopped and volumes removed"

logs:
	docker compose logs -f

status:
	docker compose ps

clean:
	mvn clean -q
	docker compose down -v --rmi local 2>/dev/null || true
	@echo "✅ Cleaned"
