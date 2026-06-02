from __future__ import annotations

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


_MODELS_FILE = Path(__file__).resolve().parent.parent / 'models.py'
_SPEC = spec_from_file_location('app._flat_models', _MODELS_FILE)

if _SPEC is None or _SPEC.loader is None:
	raise ImportError(f'Unable to load model definitions from {_MODELS_FILE}')

_MODULE = module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

for _name in dir(_MODULE):
	if _name.startswith('_'):
		continue
	globals()[_name] = getattr(_MODULE, _name)

__all__ = [name for name in globals() if not name.startswith('_')]
