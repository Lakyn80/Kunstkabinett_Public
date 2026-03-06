from __future__ import annotations

from rq import Connection, Worker

from app.modules.translation_queue.queue import get_redis_connection, get_translate_queue_name


def main() -> None:
    connection = get_redis_connection()
    queue_name = get_translate_queue_name()
    with Connection(connection):
        worker = Worker([queue_name])
        worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()

