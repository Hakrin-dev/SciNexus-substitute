# Auto-research adapter boundary

This package intentionally contains no SimpleAutoResearch source code. `protocol.py` is the stable platform contract; `mock_adapter.py` is a deterministic integration-test engine and must always report `execution_mode="mock"`. A future SimpleAutoResearch package plugs in through the same adapter without changing the database, worker, APIs, or UI.
