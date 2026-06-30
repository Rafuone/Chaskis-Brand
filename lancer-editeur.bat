@echo off
title Chaskis - Editeur du site
cd /d "%~dp0"

echo.
echo   ========================================
echo     Chaskis - Editeur du site
echo   ========================================
echo.
echo   Demarrage du serveur local...
echo   (laissez cette fenetre ouverte pendant que vous editez)
echo.

rem Lance le serveur local en arriere-plan
start "Chaskis serveur" /min python tools\dev_server.py 3000

rem Laisse au serveur le temps de demarrer
timeout /t 2 /nobreak >nul

rem Ouvre l'editeur dans le navigateur par defaut
start "" http://localhost:3000/admin

echo   C'est ouvert dans votre navigateur.
echo   Adresse : http://localhost:3000/admin
echo.
echo   Pour tout arreter : fermez cette fenetre.
echo.
pause >nul
