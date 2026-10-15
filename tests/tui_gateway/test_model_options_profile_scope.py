from pathlib import Path

from tui_gateway import server


def test_model_options_binds_requested_profile_home(monkeypatch, tmp_path):
    profile_home = tmp_path / "profiles" / "fred-work"
    profile_home.mkdir(parents=True)
    seen = {}

    monkeypatch.setattr(
        server,
        "_profile_home",
        lambda name: profile_home if name == "fred-work" else None,
    )
    monkeypatch.setattr(server, "_model_picker_context", lambda agent: object())

    def build_payload(ctx, **kwargs):
        from vetri_constants import get_vetri_home

        seen["home"] = Path(get_vetri_home())
        return {"providers": []}

    monkeypatch.setattr("vetri_cli.inventory.build_model_options_payload", build_payload)

    response = server._methods["model.options"](1, {"profile": "fred-work"})

    assert response["result"] == {"providers": []}
    assert seen["home"] == profile_home