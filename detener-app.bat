@echo off
setlocal

echo Cerrando procesos del sistema en puertos 4000 y 5173...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr :4000 ^| findstr LISTENING') do (
  powershell -Command "Stop-Process -Id %%P -Force" >nul 2>&1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
  powershell -Command "Stop-Process -Id %%P -Force" >nul 2>&1
)

echo Listo.
echo.
