"""FastAPI 应用入口。"""

from fastapi import FastAPI

from apps.parser import router as parser_router

app = FastAPI()

# 注册路由
app.include_router(parser_router)
