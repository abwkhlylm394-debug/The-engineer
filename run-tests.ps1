node --test tests/app.test.js 2>&1 | Out-File -FilePath test-output.txt -Encoding utf8
Get-Content test-output.txt
