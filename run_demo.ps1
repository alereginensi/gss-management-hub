$env:Path = "C:\Program Files\nodejs;" + $env:Path
Write-Host "Iniciando GSS Ticket Portal..." -ForegroundColor Cyan
npm run dev
