"""Shared schema base. Backend speaks camelCase JSON; Python stays snake_case.

`CamelModel` accepts camelCase input and, with model_dump(by_alias=True),
emits camelCase output — so callback payloads match the contract exactly.
"""
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )
