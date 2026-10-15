"""A secondary-profile native ticket's implicit scope must reach the audio worker thread."""
import asyncio

from vetri_constants import get_vetri_home, reset_vetri_home_override, set_vetri_home_override


def test_config_scoped_worker_keeps_the_request_home_override(tmp_path):
    from vetri_cli.web_routers.audio import _run_config_scoped

    secondary = tmp_path / "profiles" / "secondary"
    secondary.mkdir(parents=True)

    async def run():
        # What native_profile_scope does for a ticket bound to a non-launch served profile.
        token = set_vetri_home_override(str(secondary))
        try:
            return await _run_config_scoped(None, get_vetri_home)
        finally:
            reset_vetri_home_override(token)

    assert asyncio.run(run()) == secondary


def test_oauth_poller_thread_keeps_the_request_home_override(tmp_path):
    import threading

    from vetri_cli.web_routers import oauth

    secondary = tmp_path / "profiles" / "secondary"
    secondary.mkdir(parents=True)
    seen, done = {}, threading.Event()
    sid, _sess = oauth._new_oauth_session("fixture", "device_code", profile=None)

    def poller(_sid):
        seen["home"] = get_vetri_home()
        done.set()

    token = set_vetri_home_override(str(secondary))
    try:
        oauth._start_poller(poller, sid)
    finally:
        reset_vetri_home_override(token)
    assert done.wait(5)
    oauth._drop_oauth_session(sid)
    assert seen["home"] == secondary
