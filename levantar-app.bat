@echo off
setlocal

set "ROOT=%~dp0"

echo.
echo Levantando Aguas de Choluteca...
echo.

start "AguasChol Backend" cmd /k "cd /d "%ROOT%backend" && npm run start"
start "AguasChol Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev -- --host 0.0.0.0"

echo Backend:  http://localhost:4000
echo Frontend: http://localhost:5173
echo.
echo Puedes cerrar esas ventanas para detener el sistema.
echo.
