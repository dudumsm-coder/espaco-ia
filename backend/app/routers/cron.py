from fastapi import APIRouter, Depends, BackgroundTasks
from app.core.security import get_current_admin
from app.services.blog_agent import run_blog_agent

router = APIRouter(prefix="/cron", tags=["cron"])

_last_run: dict = {"status": "never", "article_id": None, "title": None, "ran_at": None}


@router.post("/blog")
async def trigger_blog_agent(
    background_tasks: BackgroundTasks,
    published: bool = False,
    _=Depends(get_current_admin),
):
    async def _run():
        global _last_run
        from datetime import datetime, timezone
        _last_run["ran_at"] = datetime.now(timezone.utc).isoformat()
        _last_run["status"] = "running"
        result = await run_blog_agent(published=published)
        _last_run.update(result)

    background_tasks.add_task(_run)
    return {"message": "Agente de blog iniciado em background", "published": published}


@router.get("/blog/status")
async def blog_status(_=Depends(get_current_admin)):
    return _last_run
