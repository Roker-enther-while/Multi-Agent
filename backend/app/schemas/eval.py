from pydantic import BaseModel


class EvalQuery(BaseModel):
    query_id: str
    query: str
