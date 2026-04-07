from pydantic import BaseModel, ConfigDict


class StrictBaseModel(BaseModel):
    """禁止额外字段的基类"""

    model_config = ConfigDict(extra="forbid")
