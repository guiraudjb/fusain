@echo off
rem Lance FUSAIN sur un serveur web local (autohebergement, sans Internet ni installation).
rem Double-cliquer ce fichier : il execute serveur-local.ps1 (PowerShell, inclus dans Windows) et ouvre
rem le navigateur sur http://localhost:8090/ . Fermer la fenetre (ou Q / Echap) arrete le serveur.
rem Options transmises au script, par exemple : lancer-site-local.bat -Port 9000 -SansNavigateur
setlocal
title FUSAIN - serveur local
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serveur-local.ps1" %*
if errorlevel 1 pause
endlocal
