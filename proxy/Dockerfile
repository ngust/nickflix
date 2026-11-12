# nfproxy - NickFlix home buffering proxy (multi-arch: python:3.12-alpine runs on x86_64 and arm64 QNAPs)
FROM python:3.12-alpine
WORKDIR /app
COPY nfproxy.py /app/nfproxy.py
USER nobody
EXPOSE 8765
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8765/health || exit 1
CMD ["python3", "-u", "/app/nfproxy.py"]
