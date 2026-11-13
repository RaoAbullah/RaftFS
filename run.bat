@echo off
title RaftFS Distributed Document Storage Cluster
echo =============================================================
echo   Starting RaftFS Distributed Cluster on Localhost...
echo =============================================================
cd /d "%~dp0"
start http://localhost:3000
npm start
pause
