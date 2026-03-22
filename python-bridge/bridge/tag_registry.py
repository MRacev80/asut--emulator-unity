"""
TagRegistry — loads tags.yaml, provides lookup by tag_id.
Engineers add/remove tags in YAML without touching Python code.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import yaml


@dataclass
class TagDef:
    tag_id: str
    node_id: str
    data_type: str
    writable: bool
    unit: str
    description: str


class TagRegistry:
    def __init__(self, yaml_path: str | Path):
        self._tags: dict[str, TagDef] = {}
        self._load(Path(yaml_path))

    def _load(self, path: Path) -> None:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        for t in data["tags"]:
            tag = TagDef(
                tag_id=t["tag_id"],
                node_id=t["node_id"],
                data_type=t["data_type"],
                writable=t.get("writable", False),
                unit=t.get("unit", ""),
                description=t.get("description", ""),
            )
            self._tags[tag.tag_id] = tag

    def get(self, tag_id: str) -> TagDef | None:
        return self._tags.get(tag_id)

    def all(self) -> list[TagDef]:
        return list(self._tags.values())

    def writable_ids(self) -> set[str]:
        return {t.tag_id for t in self._tags.values() if t.writable}
