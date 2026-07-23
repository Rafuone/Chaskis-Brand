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

rem Lance le serveur local en arriere-plan (Node = statique + Functions /api ;
rem dev_server.py ne sert QUE le statique et renvoie 501 sur /api)
start "Chaskis serveur" /min node tools\api-server.js 3000

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
