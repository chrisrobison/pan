.PHONY: help test test-headed test-browser clean

# Default target
help:
	@echo "PAN Test Suite"
	@echo ""
	@echo "Available targets:"
	@echo "  make test          - Run all tests (headless)"
	@echo "  make test-headed   - Run tests with visible browser"
	@echo "  make test-browser  - Open HTML test runner in browser"
	@echo "  make test-file     - Run a specific test file"
	@echo "                       Usage: make test-file FILE=tests/core/pan-bus.test.mjs"
	@echo "  make clean         - Clean test artifacts"
	@echo ""

# Run all tests headlessly
test:
	@node tests/lib/cli-runner.mjs

# Run tests with visible browser
test-headed:
	@node tests/lib/cli-runner.mjs --headed

# Open browser-based test runner
test-browser:
	@echo "Opening browser test runner..."
	@echo "Please open tests/index.html in your browser"
	@which python3 > /dev/null && python3 -m http.server 8000 || echo "Tip: Run 'python3 -m http.server 8000' to serve files locally"

# Run a specific test file
test-file:
ifdef FILE
	@node tests/lib/cli-runner.mjs $(FILE)
else
	@echo "Error: Please specify a file with FILE=path/to/test.mjs"
	@exit 1
endif

# Clean test artifacts
clean:
	@echo "Cleaning test artifacts..."
	@rm -rf test-results/
	@rm -rf playwright-report/
	@echo "Done!"
