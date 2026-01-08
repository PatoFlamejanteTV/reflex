.PHONY: all build-client run-client run-server clean lint

all: build-client

build-client:
	python3 -m nuitka --standalone --onefile --lto=yes --remove-output --assume-yes-for-downloads --python-flag=-O --output-dir=dist client/client.py

run-client:
	./client.sh

run-server:
	./server.sh

clean:
	rm -rf dist build client.dist client.build *.onefile-build
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +

lint:
	flake8 client
	npm run lint --prefix server
