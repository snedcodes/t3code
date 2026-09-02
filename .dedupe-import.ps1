$p='apps/mobile/src/features/threads/ThreadDetailScreen.tsx'
$lines=Get-Content $p
$seen=$false
$out=foreach($line in $lines) { if($line -like '*import { useSpokenCompletionAlerts } from*') { if($seen) { continue }; $seen=$true }; $line }
[IO.File]::WriteAllLines($p,$out,(New-Object Text.UTF8Encoding($false)))
