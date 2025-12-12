@echo off
set "cert_path=C:\Users\Batcave\Desktop\LeagueDeceiver\certs\code-signing.pfx"
set "base64_output=C:\Users\Batcave\Desktop\LeagueDeceiver\certs\code-signing.pfx.base64"

echo Generating base64 encoded certificate...
echo.

powershell -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('%cert_path%')) > %base64_output%"

echo.
echo Base64 encoded certificate saved to %base64_output%
echo.