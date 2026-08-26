import copy
import errno
import os
import shutil
import socket
import tempfile
import threading
from contextlib import contextmanager

import toml
from loguru import logger

from app import __version__

root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
config_file = f"{root_dir}/config.toml"
_CONTAINER_CGROUP_MARKERS = ("docker", "containerd", "kubepods", "libpod", "podman")
_DOCKER_HOST_GATEWAY_NAME = "host.docker.internal"
_config_save_lock = threading.RLock()
_pending_config_lock = threading.RLock()
_pending_config_updates = {}
_pending_config_save_requested = False
_pending_config_flush_scheduled = False
_MISSING = object()
_DELETE = object()
_UTF8_BOM = "\ufeff"


class _SynchronizedConfig(dict):
    """Preserve standard dict behavior while ensuring runtime configuration writes obey the shared lock."""

    def __setitem__(self, key, value):
        # Streamlit writes control values back to config on every page rerun.
        # When a video task holds runtime_config_lock, if the value has not changed,
        # this write has no side effects and should not block the refreshed page.
        # Writes that actually modify configuration acquire the lock below,
        # preventing mid-generation provider/key switches.
        current = super().get(key, _MISSING)
        if current is not _MISSING and current == value:
            return
        with _config_save_lock:
            super().__setitem__(key, value)

    def __delitem__(self, key):
        with _config_save_lock:
            super().__delitem__(key)

    def clear(self):
        if not self:
            return
        with _config_save_lock:
            super().clear()

    def pop(self, key, default=_MISSING):
        # ``pop(key, default)`` does not change config if key is absent.
        # WebUI uses this pattern to express 'use default strategy'; refresh operations must complete immediately.
        if key not in self:
            if default is _MISSING:
                raise KeyError(key)
            return default
        with _config_save_lock:
            if default is _MISSING:
                return super().pop(key)
            return super().pop(key, default)

    def setdefault(self, key, default=None):
        # Similar to __setitem__, setdefault on an existing key is read-only.
        # Returning early prevents read-only page refreshes from being blocked by long tasks.
        current = super().get(key, _MISSING)
        if current is not _MISSING:
            return current
        with _config_save_lock:
            return super().setdefault(key, default)

    def update(self, *args, **kwargs):
        changes = dict(*args, **kwargs)
        if all(
            (current := dict.get(self, key, _MISSING)) is not _MISSING
            and current == value
            for key, value in changes.items()
        ):
            return
        with _config_save_lock:
            super().update(changes)


def _pending_update_key(config_section, key):
    """Generate pending update key for in-process config section."""
    return id(config_section), key


def update_config_nonblocking(config_section, key, value):
    """
    Non-blocking update of WebUI runtime configuration.

    Video generation holds ``runtime_config_lock`` to prevent mid-task provider/key changes.
    Streamlit widgets should not block on this lock to avoid freezing the browser.
    When the lock is busy, updates queue up and are applied once the lock is released.

    Returns True if immediately applied, False if enqueued.
    """
    with _pending_config_lock:
        _pending_config_updates[_pending_update_key(config_section, key)] = (
            config_section,
            key,
            copy.deepcopy(value),
        )

    acquired = _config_save_lock.acquire(blocking=False)
    if not acquired:
        _schedule_deferred_config_flush()
        return False

    try:
        _apply_pending_config_updates_locked()
        return config_section.get(key, _MISSING) == value
    finally:
        _config_save_lock.release()


def delete_config_nonblocking(config_section, key):
    """
    Non-blocking deletion of WebUI configuration entry.

    Resetting to defaults requires removing the key rather than writing an empty string.
    If a video task holds the lock, deletion intent queues up and executes upon release.
    """
    with _pending_config_lock:
        _pending_config_updates[_pending_update_key(config_section, key)] = (
            config_section,
            key,
            _DELETE,
        )

    acquired = _config_save_lock.acquire(blocking=False)
    if not acquired:
        _schedule_deferred_config_flush()
        return False

    try:
        _apply_pending_config_updates_locked()
        return key not in config_section
    finally:
        _config_save_lock.release()


def _apply_pending_config_updates_locked():
    """Apply staged WebUI config updates while holding config write lock."""
    with _pending_config_lock:
        updates = list(_pending_config_updates.values())
        _pending_config_updates.clear()
        for config_section, key, value in updates:
            if value is _DELETE:
                config_section.pop(key, None)
            else:
                config_section[key] = value
    return bool(updates)


def snapshot_config_with_pending(config_section):
    """
    Return effective snapshot of a config section merged with pending WebUI updates.

    Allows user to prepare upcoming content while a running video task holds the lock.
    """
    with _pending_config_lock:
        snapshot = dict(config_section)
        section_id = id(config_section)
        for (pending_section_id, key), (_, _, value) in _pending_config_updates.items():
            if pending_section_id != section_id:
                continue
            if value is _DELETE:
                snapshot.pop(key, None)
            else:
                snapshot[key] = copy.deepcopy(value)
    return snapshot


def _flush_pending_config_locked(*, suppress_save_errors):
    """Apply and persist all pending config updates while holding lock."""
    global _pending_config_save_requested

    updates_applied = _apply_pending_config_updates_locked()
    with _pending_config_lock:
        save_requested = _pending_config_save_requested
        _pending_config_save_requested = False

    if not updates_applied and not save_requested:
        return True

    try:
        save_config()
        return True
    except Exception as exc:
        with _pending_config_lock:
            _pending_config_save_requested = True
        if not suppress_save_errors:
            raise
        logger.exception(f"failed to save deferred runtime config: {exc}")
        return False


def _run_deferred_config_flush():
    """Wait for long-running task to release config lock and flush updates reliably."""
    global _pending_config_flush_scheduled

    while True:
        with _config_save_lock:
            flush_succeeded = _flush_pending_config_locked(
                suppress_save_errors=True
            )

        with _pending_config_lock:
            has_pending_work = bool(
                _pending_config_updates or _pending_config_save_requested
            )
            if not flush_succeeded or not has_pending_work:
                _pending_config_flush_scheduled = False
                return


def _schedule_deferred_config_flush():
    """Ensure at most one background thread waits to flush configuration."""
    global _pending_config_flush_scheduled

    with _pending_config_lock:
        if _pending_config_flush_scheduled:
            return
        _pending_config_flush_scheduled = True

    threading.Thread(
        target=_run_deferred_config_flush,
        name="chronus-config-flush",
        daemon=True,
    ).start()


def try_save_config():
    """
    Non-blocking WebUI config save; delegates to background completion when lock is busy.
    """
    global _pending_config_save_requested

    with _pending_config_lock:
        _pending_config_save_requested = True

    acquired = _config_save_lock.acquire(blocking=False)
    if not acquired:
        _schedule_deferred_config_flush()
        return False

    try:
        return _flush_pending_config_locked(suppress_save_errors=False)
    finally:
        _config_save_lock.release()


@contextmanager
def runtime_config_lock():
    """
    Prevent other sessions from mutating configuration during critical operations.
    """
    with _config_save_lock:
        _flush_pending_config_locked(suppress_save_errors=True)
        try:
            yield
        finally:
            _flush_pending_config_locked(suppress_save_errors=True)


@contextmanager
def try_runtime_config_lock():
    """
    Attempt to acquire runtime config lock, returning success status immediately.
    """
    acquired = _config_save_lock.acquire(blocking=False)
    try:
        if acquired:
            _flush_pending_config_locked(suppress_save_errors=True)
        yield acquired
    finally:
        if acquired:
            _flush_pending_config_locked(suppress_save_errors=True)
            _config_save_lock.release()


def is_running_in_container(
    dockerenv_path: str = "/.dockerenv",
    containerenv_path: str = "/run/.containerenv",
    cgroup_path: str = "/proc/1/cgroup",
) -> bool:
    """
    Determine if current process is running inside a container.
    """
    if os.path.isfile(dockerenv_path) or os.path.isfile(containerenv_path):
        return True

    try:
        with open(cgroup_path, mode="r", encoding="utf-8") as fp:
            cgroup_content = fp.read().lower()
    except OSError:
        return False

    return any(marker in cgroup_content for marker in _CONTAINER_CGROUP_MARKERS)


def _can_resolve_hostname(hostname: str) -> bool:
    try:
        socket.gethostbyname(hostname)
    except OSError:
        return False
    return True


def _decode_linux_route_gateway(hex_gateway: str) -> str:
    if len(hex_gateway) != 8:
        raise ValueError("invalid gateway length")

    octets = [
        str(int(hex_gateway[index : index + 2], 16)) for index in range(6, -1, -2)
    ]
    return ".".join(octets)


def get_container_default_gateway_ip(route_path: str = "/proc/net/route") -> str:
    """
    Read default gateway IP inside a Linux container.
    """
    try:
        with open(route_path, mode="r", encoding="utf-8") as fp:
            route_lines = fp.readlines()
    except OSError:
        return ""

    for line in route_lines[1:]:
        fields = line.strip().split()
        if len(fields) < 3:
            continue

        destination = fields[1]
        gateway = fields[2]
        if destination != "00000000" or gateway == "00000000":
            continue

        try:
            return _decode_linux_route_gateway(gateway)
        except ValueError:
            logger.warning(f"invalid container gateway route entry: {line.strip()}")
            return ""

    return ""


def get_default_ollama_base_url() -> str:
    """
    Return default OpenAI-compatible base_url for Ollama.
    """
    if not is_running_in_container():
        return "http://localhost:11434/v1"

    if _can_resolve_hostname(_DOCKER_HOST_GATEWAY_NAME):
        return f"http://{_DOCKER_HOST_GATEWAY_NAME}:11434/v1"

    gateway_ip = get_container_default_gateway_ip()
    if gateway_ip:
        logger.info(
            "host.docker.internal is not resolvable, fallback to container "
            f"default gateway for Ollama: {gateway_ip}"
        )
        return f"http://{gateway_ip}:11434/v1"

    logger.warning(
        "failed to resolve host.docker.internal and container default gateway; "
        "fallback to host.docker.internal for Ollama"
    )
    return f"http://{_DOCKER_HOST_GATEWAY_NAME}:11434/v1"


def _load_toml_config(config_path: str):
    """
    Load TOML configuration with UTF-8 BOM compatibility.
    """
    try:
        return toml.load(config_path)
    except (toml.TomlDecodeError, UnicodeDecodeError) as exc:
        logger.warning(
            "load config failed, retry with UTF-8 BOM compatibility: "
            f"path={config_path}, error={type(exc).__name__}: {exc}"
        )

    try:
        with open(config_path, mode="r", encoding="utf-8-sig") as fp:
            config_content = fp.read()

        normalized_content = config_content.lstrip(_UTF8_BOM)
        removed_bom_count = len(config_content) - len(normalized_content)
        if removed_bom_count:
            logger.warning(
                "removed repeated UTF-8 BOM characters while loading config: "
                f"path={config_path}, count={removed_bom_count}"
            )
        return toml.loads(normalized_content)
    except (toml.TomlDecodeError, UnicodeDecodeError) as exc:
        logger.error(
            "config file is not valid TOML after UTF-8 BOM normalization: "
            f"path={config_path}, error={type(exc).__name__}: {exc}"
        )
        raise


def load_config():
    # Fix directory collision edge case
    if os.path.isdir(config_file):
        shutil.rmtree(config_file)

    if not os.path.isfile(config_file):
        example_file = f"{root_dir}/config.example.toml"
        if os.path.isfile(example_file):
            shutil.copyfile(example_file, config_file)
            logger.info("copy config.example.toml to config.toml")

    logger.info(f"load config from file: {config_file}")

    return _load_toml_config(config_file)


def save_config():
    """
    Atomically save runtime configuration to file.
    """
    with _config_save_lock:
        config_to_save = dict(_cfg)
        config_to_save["app"] = dict(app)
        config_to_save["azure"] = dict(azure)
        config_to_save["siliconflow"] = dict(siliconflow)
        config_to_save["minimax_tts"] = dict(minimax_tts)
        config_to_save["elevenlabs"] = dict(elevenlabs)
        config_to_save["chatterbox"] = dict(chatterbox)
        config_to_save["fish_audio"] = dict(fish_audio)
        config_to_save["ui"] = dict(ui)
        serialized_config = toml.dumps(config_to_save)

        try:
            with open(config_file, mode="r", encoding="utf-8") as f:
                if f.read() == serialized_config:
                    _cfg.clear()
                    _cfg.update(config_to_save)
                    return
        except (OSError, UnicodeError):
            pass

        temp_path = ""
        try:
            fd, temp_path = tempfile.mkstemp(
                prefix=".config-",
                suffix=".toml.tmp",
                dir=root_dir,
            )
            with os.fdopen(fd, mode="w", encoding="utf-8") as f:
                f.write(serialized_config)
                f.flush()
                os.fsync(f.fileno())
            try:
                os.replace(temp_path, config_file)
            except OSError as exc:
                if exc.errno != errno.EBUSY:
                    raise

                logger.warning(
                    "atomic config replacement is unavailable for the mounted "
                    f"file, fallback to in-place write: {config_file}"
                )
                with open(config_file, mode="w", encoding="utf-8") as f:
                    f.write(serialized_config)
                    f.flush()
                    os.fsync(f.fileno())
            _cfg.clear()
            _cfg.update(config_to_save)
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)


_cfg = load_config()
app = _SynchronizedConfig(_cfg.get("app", {}))
whisper = _cfg.get("whisper", {})
proxy = _cfg.get("proxy", {})
azure = _SynchronizedConfig(_cfg.get("azure", {}))
siliconflow = _SynchronizedConfig(_cfg.get("siliconflow", {}))
minimax_tts = _SynchronizedConfig(_cfg.get("minimax_tts", {}))
elevenlabs = _SynchronizedConfig(_cfg.get("elevenlabs", {}))
chatterbox = _SynchronizedConfig(_cfg.get("chatterbox", {}))
fish_audio = _SynchronizedConfig(_cfg.get("fish_audio", {}))
ui = _SynchronizedConfig(
    _cfg.get(
        "ui",
        {
            "hide_log": False,
        },
    )
)

hostname = socket.gethostname()

log_level = _cfg.get("log_level", "DEBUG")
listen_host = _cfg.get("listen_host", "0.0.0.0")
listen_port = _cfg.get("listen_port", 8080)
project_name = _cfg.get("project_name", "Chronus")
project_description = _cfg.get(
    "project_description",
    "Chronus AI Video Platform",
)
project_version = _cfg.get("project_version", __version__)
reload_debug = False

app["redis_host"] = os.getenv(
    "MPT_APP_REDIS_HOST",
    os.getenv("REDIS_HOST", app.get("redis_host", "localhost")),
)

ffmpeg_path = app.get("ffmpeg_path", "")
if ffmpeg_path and os.path.isfile(ffmpeg_path):
    os.environ["IMAGEIO_FFMPEG_EXE"] = ffmpeg_path

logger.info(f"{project_name} v{project_version}")
