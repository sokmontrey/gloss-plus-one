from pydantic import BaseModel


class Unit(BaseModel):
    """A unit of replaceable text"""

    start: int
    end: int
    text: str
    word_class: str

    def __str__(self) -> str:
        return f'[start: {self.start}, end: {self.end}, text: "{self.text}", word_class: {self.word_class}]'


class Request(BaseModel):
    text: str


class Response(BaseModel):
    original: str
    units: list[Unit]
